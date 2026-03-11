import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { verifySocketToken } from '../../common/auth/ws-auth.util';

/**
 * WebSocket JWT Guard — authenticates Socket.IO connections.
 *
 * Token is extracted from:
 *   1. socket.handshake.auth.token  (preferred — Socket.IO 4.x)
 *   2. socket.handshake.query.token (fallback — for older clients)
 *
 * On success, attaches `client.data.user` with the decoded payload.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();

    try {
      const payload = await verifySocketToken(
        this.jwtService,
        this.configService,
        client,
      );

      if (!payload) {
        this.logger.warn(`Connection rejected: no token (socket ${client.id})`);
        throw new WsException('Authentication token missing');
      }

      // Attach user info to the socket for downstream handlers
      client.data.user = {
        _id: payload.sub,
        email: payload.email,
      };

      return true;
    } catch (err) {
      this.logger.warn(
        `Connection rejected: invalid token (socket ${client.id})`,
      );
      throw new WsException('Invalid authentication token');
    }
  }
}
