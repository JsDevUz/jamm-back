import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from '../presence/guards/ws-jwt.guard';
import { ChatsService } from './chats.service';
import { getAllowedOrigins } from '../common/config/cors.config';
import { verifySocketToken } from '../common/auth/ws-auth.util';
import { SocketRateLimiter } from '../common/ws/socket-rate-limiter';

@WebSocketGateway({
  namespace: '/chats',
  cors: { origin: getAllowedOrigins(), credentials: true },
})
export class ChatsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatsGateway.name);
  private readonly rateLimiter = new SocketRateLimiter();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ChatsService))
    private readonly chatsService: ChatsService,
  ) {}

  afterInit() {
    this.logger.log('ChatsGateway initialized on /chats namespace');
  }

  async handleConnection(client: Socket) {
    try {
      const payload = await verifySocketToken(
        this.jwtService,
        this.configService,
        client,
      );

      if (!payload) {
        throw new Error('Authentication token missing');
      }

      client.data.user = {
        _id: payload.sub,
        email: payload.email,
      };

      // Join personal room for cross-chat notifications
      client.join(`user_${payload.sub}`);

      this.logger.debug(
        `Client connected to /chats: ${client.id} (User: ${payload.sub})`,
      );
    } catch (err) {
      this.logger.warn(
        `Connection rejected: invalid token (socket ${client.id})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from /chats: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_chat')
  handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.rateLimiter.take(`join_chat:${client.id}`, 20, 60_000);
    const room = `chat_${data.chatId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room ${room}`);
    return { success: true, room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.rateLimiter.take(`leave_chat:${client.id}`, 30, 60_000);
    const room = `chat_${data.chatId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room ${room}`);
    return { success: true, room };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('read_messages')
  async handleReadMessages(
    @MessageBody() data: { chatId: string; messageIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.rateLimiter.take(`read_messages:${client.id}`, 60, 60_000);
    if (!data.chatId || !data.messageIds || data.messageIds.length === 0) {
      return { success: false };
    }
    const userId = client.data.user._id;
    await this.chatsService.markMessagesAsRead(
      data.chatId,
      userId,
      data.messageIds,
    );
    return { success: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.rateLimiter.take(`typing:${client.id}`, 120, 60_000);
    const userId = client.data.user._id;
    client.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId,
      isTyping: true,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.rateLimiter.take(`typing:${client.id}`, 120, 60_000);
    const userId = client.data.user._id;
    client.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId,
      isTyping: false,
    });
  }
}
