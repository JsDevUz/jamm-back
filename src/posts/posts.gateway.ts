import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { getAllowedOrigins } from '../common/config/cors.config';
import { verifySocketToken } from '../common/auth/ws-auth.util';

@WebSocketGateway({
  namespace: '/posts',
  cors: { origin: getAllowedOrigins(), credentials: true },
})
export class PostsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PostsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('PostsGateway initialized on /posts namespace');
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
      client.join(`user_${payload.sub}`);
    } catch {
      this.logger.warn(
        `Connection rejected: invalid token (socket ${client.id})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from /posts: ${client.id}`);
  }

  emitPostUpdated(payload: unknown) {
    this.server.emit('post_updated', payload);
  }

  emitPostDeleted(postId: string) {
    this.server.emit('post_deleted', { postId });
  }

  emitPostCommentsUpdated(postId: string, comments?: number) {
    this.server.emit('post_comments_updated', {
      postId,
      ...(typeof comments === 'number' ? { comments } : {}),
    });
  }
}
