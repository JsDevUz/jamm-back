import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/courses',
  cors: { origin: true, credentials: true },
})
export class CoursesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CoursesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('CoursesGateway initialized on /courses namespace');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        (client.handshake?.query?.token as string);

      if (!token) {
        throw new Error('Authentication token missing');
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'fallback-secret';

      const payload = await this.jwtService.verifyAsync(token, { secret });

      client.data.user = {
        _id: payload.sub,
        email: payload.email,
      };

      // Join personal room for user-specific events
      client.join(`user_${payload.sub}`);

      this.logger.debug(
        `Client connected to /courses: ${client.id} (User: ${payload.sub})`,
      );
    } catch (err) {
      this.logger.warn(
        `Connection rejected: invalid token (socket ${client.id})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from /courses: ${client.id}`);
  }

  @SubscribeMessage('join_course')
  handleJoinCourse(
    @MessageBody() data: { courseId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `course_${data.courseId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leave_course')
  handleLeaveCourse(
    @MessageBody() data: { courseId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `course_${data.courseId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room ${room}`);
    return { success: true, room };
  }

  // Helper method to alert a specific user
  notifyUser(userId: string, eventName: string, payload: any) {
    this.server.to(`user_${userId}`).emit(eventName, payload);
  }

  // Broadcaster for a specific course channel (e.g., general stats updates)
  notifyCourse(courseId: string, eventName: string, payload: any) {
    this.server.to(`course_${courseId}`).emit(eventName, payload);
  }
}
