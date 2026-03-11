import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  RedisPresenceService,
  PresenceStatusEvent,
} from './redis-presence.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { getAllowedOrigins } from '../common/config/cors.config';
import { verifySocketToken } from '../common/auth/ws-auth.util';
import { SocketRateLimiter } from '../common/ws/socket-rate-limiter';

/**
 * PresenceGateway — manages online/offline presence via WebSocket.
 *
 * Namespace:  /presence
 * Auth:       JWT token in socket.handshake.auth.token
 *
 * Events emitted to clients:
 *   - user_online   { userId: string }
 *   - user_offline  { userId: string, lastSeen: string }
 *
 * Events from clients:
 *   - presence:ping  (heartbeat, no payload needed)
 */
@WebSocketGateway({
  namespace: '/presence',
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
})
export class PresenceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);
  private readonly rateLimiter = new SocketRateLimiter();

  constructor(
    private readonly redisPresence: RedisPresenceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  /**
   * Called once after the gateway is initialized.
   * Sets up Redis Pub/Sub listener to relay status changes to all connected clients.
   */
  async afterInit() {
    this.logger.log('PresenceGateway initialized on /presence namespace');

    // Subscribe to Redis Pub/Sub for cross-instance status broadcasting
    await this.redisPresence.subscribeToStatusChanges(
      (event: PresenceStatusEvent) => {
        if (event.status === 'online') {
          this.server.emit('user_online', { userId: event.userId });
        } else {
          this.server.emit('user_offline', {
            userId: event.userId,
            lastSeen: new Date(event.timestamp).toISOString(),
          });
        }
      },
    );
  }

  /**
   * Handles new WebSocket connection.
   * Manually verifies JWT (guards don't run on connection lifecycle hooks).
   */
  async handleConnection(client: Socket) {
    try {
      const payload = await verifySocketToken(
        this.jwtService,
        this.configService,
        client,
      );

      if (!payload) {
        this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
        client.disconnect(true);
        return;
      }

      const userId = payload.sub;
      const user = await this.userModel
        .findById(userId)
        .select('username')
        .lean()
        .exec();
      const officialProfile =
        await this.appSettingsService.getOfficialProfileByUsername(
          user?.username,
        );

      // Attach user data to the socket
      client.data.user = { _id: userId, email: payload.email };
      client.data.isOfficialProfile = Boolean(officialProfile?.hidePresence);

      // Join a user-specific room (for targeted messaging)
      client.join(`user:${userId}`);

      if (officialProfile?.hidePresence) {
        this.logger.log(`Official profile ${userId} connected silently`);
        return;
      }

      // Mark online in Redis
      const deviceCount = await this.redisPresence.setOnline(userId);

      this.logger.log(
        `User ${userId} connected (socket: ${client.id}, devices: ${deviceCount})`,
      );
    } catch (err) {
      this.logger.warn(`Connection auth failed: ${client.id} — ${err.message}`);
      client.disconnect(true);
    }
  }

  /**
   * Handles WebSocket disconnection.
   * Decrements device count and updates lastSeen in MongoDB if fully offline.
   */
  async handleDisconnect(client: Socket) {
    const userId = client.data?.user?._id;
    if (!userId) return;
    if (client.data?.isOfficialProfile) return;

    try {
      const remainingDevices = await this.redisPresence.removeDevice(userId);

      if (remainingDevices === 0) {
        // User is fully offline — persist lastSeen to MongoDB
        await this.userModel.updateOne(
          { _id: userId },
          { $set: { lastSeen: new Date() } },
        );
        this.logger.log(`User ${userId} fully offline, lastSeen updated`);
      } else {
        this.logger.log(
          `User ${userId} disconnected a device (socket: ${client.id}, remaining: ${remainingDevices})`,
        );
      }
    } catch (err) {
      this.logger.error(`Error handling disconnect for ${userId}`, err);
    }
  }

  /**
   * Client heartbeat — refreshes the presence TTL in Redis.
   * Must be called every 20–25 seconds by the client.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('presence:ping')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?._id;
    if (!userId) return;
    this.rateLimiter.take(`presence:ping:${client.id}`, 240, 60_000);
    if (client.data?.isOfficialProfile) {
      return { event: 'presence:pong', data: { status: 'ok' } };
    }

    await this.redisPresence.refreshTTL(userId);
    return { event: 'presence:pong', data: { status: 'ok' } };
  }

  // ─── Private Call Signaling ──────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:request')
  async handleCallRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { toUserId: string; roomId: string; callType?: string },
  ) {
    this.rateLimiter.take(`presence:call-request:${client.id}`, 15, 60_000);
    const fromUserId = client.data.user._id;
    const { toUserId, roomId, callType = 'video' } = data;

    this.logger.log(
      `Call request from ${fromUserId} to ${toUserId} (room: ${roomId})`,
    );

    // Fetch sender info for the notification
    const sender = await this.userModel
      .findById(fromUserId)
      .select('nickname username avatar')
      .lean();

    const targetUser = await this.userModel
      .findById(toUserId)
      .select('username')
      .lean()
      .exec();
    const officialProfile =
      await this.appSettingsService.getOfficialProfileByUsername(
        targetUser?.username,
      );
    if (officialProfile?.disableCalls) {
      this.server.to(`user:${fromUserId}`).emit('call:rejected', {
        fromUserId: toUserId,
        roomId,
        reason: 'official-profile',
      });
      return;
    }

    this.server.to(`user:${toUserId}`).emit('call:incoming', {
      fromUser: {
        _id: fromUserId,
        name: sender?.nickname || sender?.username || 'Unknown',
        avatar: sender?.avatar,
      },
      roomId,
      callType,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; roomId: string },
  ) {
    this.rateLimiter.take(`presence:call-respond:${client.id}`, 30, 60_000);
    const fromUserId = client.data.user._id;
    this.server.to(`user:${data.toUserId}`).emit('call:accepted', {
      fromUserId,
      roomId: data.roomId,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:reject')
  async handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; roomId: string; reason?: string },
  ) {
    this.rateLimiter.take(`presence:call-respond:${client.id}`, 30, 60_000);
    const fromUserId = client.data.user._id;
    this.server.to(`user:${data.toUserId}`).emit('call:rejected', {
      fromUserId,
      roomId: data.roomId,
      reason: data.reason || 'declined',
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call:cancel')
  async handleCallCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; roomId: string },
  ) {
    this.rateLimiter.take(`presence:call-cancel:${client.id}`, 30, 60_000);
    const fromUserId = client.data.user._id;
    this.server.to(`user:${data.toUserId}`).emit('call:cancelled', {
      fromUserId,
      roomId: data.roomId,
    });
  }
}
