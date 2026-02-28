import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
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
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
})
export class PresenceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private readonly redisPresence: RedisPresenceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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
      const token =
        client.handshake?.auth?.token ||
        (client.handshake?.query?.token as string);

      if (!token) {
        this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
        client.disconnect(true);
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.sub;

      // Attach user data to the socket
      client.data.user = { _id: userId, email: payload.email };

      // Join a user-specific room (for targeted messaging)
      client.join(`user:${userId}`);

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

    await this.redisPresence.refreshTTL(userId);
    return { event: 'presence:pong', data: { status: 'ok' } };
  }
}
