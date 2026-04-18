import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import {
  extractTokenFromCookieHeader,
  extractCookieValue,
  getJwtSecret,
  APP_UNLOCK_COOKIE_NAME,
  APP_UNLOCK_HEADER_NAME,
} from '../auth-cookie.util';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) =>
          extractTokenFromCookieHeader(request?.headers?.cookie || ''),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  private isUnlockExemptPath(pathname: string) {
    return [
      '/auth/me',
      '/auth/logout',
      '/users/me/app-lock/verify',
      '/users/me/app-lock/logout-clear',
      '/users/me/app-lock/lock-session',
    ].some((path) => pathname.startsWith(path));
  }

  private isAppUnlockTokenValid(
    request: any,
    userId: string,
    secret: string,
  ) {
    const cookieToken = extractCookieValue(
      request?.headers?.cookie || '',
      APP_UNLOCK_COOKIE_NAME,
    );
    const headerToken = request?.headers?.[APP_UNLOCK_HEADER_NAME];
    const rawToken = String(cookieToken || headerToken || '').trim();

    if (!rawToken) {
      return false;
    }

    try {
      const decoded = this.jwtService.verify(rawToken, { secret }) as {
        sub?: string;
        type?: string;
      };
      return decoded?.type === 'app-unlock' && decoded?.sub === userId;
    } catch {
      return false;
    }
  }

  async validate(request: any, payload: { sub: string; email: string; tokenId?: string }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.isBlocked) {
      throw new HttpException(
        "Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.",
        HttpStatus.LOCKED,
      );
    }

    // Validate session if tokenId is present in the JWT payload
    if (payload.tokenId) {
      const isValid = await this.sessionService.isSessionValid(payload.tokenId);
      if (!isValid) {
        throw new UnauthorizedException('Session bekor qilingan. Qayta kiring.');
      }
      // Update lastUsedAt in the background (no await to avoid latency)
      void this.sessionService.touchSession(payload.tokenId);
    }

    if (user.appLockEnabled) {
      const pathname = String(request?.originalUrl || request?.url || '');
      if (!this.isUnlockExemptPath(pathname)) {
        const secret = getJwtSecret(this.configService);
        if (!this.isAppUnlockTokenValid(request, payload.sub, secret)) {
          throw new HttpException('APP_LOCK_REQUIRED', HttpStatus.LOCKED);
        }
      }
    }
    return user;
  }
}
