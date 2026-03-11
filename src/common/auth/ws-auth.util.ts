import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { extractTokenFromCookieHeader, getJwtSecret } from '../../auth/auth-cookie.util';

export const extractSocketToken = (client: Socket): string | null =>
  client.handshake?.auth?.token ||
  (client.handshake?.query?.token as string) ||
  extractTokenFromCookieHeader(client.handshake?.headers?.cookie || '');

export const verifySocketToken = async (
  jwtService: JwtService,
  configService: ConfigService,
  client: Socket,
) => {
  const token = extractSocketToken(client);
  if (!token) {
    return null;
  }

  return jwtService.verifyAsync(token, {
    secret: getJwtSecret(configService),
  });
};
