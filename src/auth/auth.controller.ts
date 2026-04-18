import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AUTH_COOKIE_NAME,
  APP_UNLOCK_COOKIE_NAME,
  buildAuthCookieOptions,
  buildAppUnlockCookieOptions,
  extractCookieValue,
  getJwtSecret,
} from './auth-cookie.util';
import { ConfigService } from '@nestjs/config';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { JwtService } from '@nestjs/jwt';
import type { Request as ExpressRequest } from 'express';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private appSettingsService: AppSettingsService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  private buildGoogleRedirectUri(request: ExpressRequest) {
    const configured =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') || '';
    if (configured.trim()) {
      return configured.trim();
    }

    const protocol =
      (request.headers['x-forwarded-proto'] as string) ||
      request.protocol ||
      'http';
    const host = request.get('host') || 'localhost:3000';
    return `${protocol}://${host}/auth/google/callback`;
  }

  private buildFrontendRedirectUrl(path: string) {
    const configured =
      this.configService.get<string>('FRONTEND_APP_URL') ||
      this.configService.get<string>('APP_CLIENT_URL') ||
      '';

    const base = configured.trim().replace(/\/+$/, '');
    if (base) {
      return `${base}${path}`;
    }

    return path;
  }

  private getMobileGoogleReturnUrl(request: ExpressRequest) {
    const requested = String(request?.query?.return_url || '').trim();

    if (!requested) {
      return null;
    }

    if (/^jamm:\/\/[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]+$/.test(requested)) {
      return requested;
    }

    return null;
  }

  private buildGoogleErrorRedirect(request: ExpressRequest, message: string) {
    const mobileReturnUrl = extractCookieValue(
      request?.headers?.cookie || '',
      'jamm_google_oauth_return',
    );

    if (mobileReturnUrl && mobileReturnUrl.startsWith('jamm://')) {
      const separator = mobileReturnUrl.includes('?') ? '&' : '?';
      return `${mobileReturnUrl}${separator}google_error=${encodeURIComponent(message)}`;
    }

    return this.buildFrontendRedirectUrl(
      `/login?google_error=${encodeURIComponent(message)}`,
    );
  }

  private isAppUnlocked(request: ExpressRequest, user: any) {
    if (!user?.appLockEnabled) {
      return true;
    }

    const rawToken = extractCookieValue(
      request?.headers?.cookie || '',
      APP_UNLOCK_COOKIE_NAME,
    );

    if (!rawToken) {
      return false;
    }

    try {
      const decoded = this.jwtService.verify(rawToken, {
        secret: getJwtSecret(this.configService),
      }) as { sub?: string; type?: string };

      return (
        decoded?.type === 'app-unlock' &&
        decoded?.sub === String(user?._id || '')
      );
    } catch {
      return false;
    }
  }

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Request() req: ExpressRequest,
  ) {
    const data = await this.authService.login(loginDto, req);
    res.cookie(
      AUTH_COOKIE_NAME,
      data.access_token,
      buildAuthCookieOptions(this.configService),
    );
    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return {
      user: await this.appSettingsService.decorateUserPayload({
        ...data.user,
        appLockSessionUnlocked: false,
      }),
      access_token: data.access_token,
    };
  }

  @Get('verify/:token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verify(@Request() req, @Res({ passthrough: true }) res: Response) {
    const { token } = req.params;
    const data = await this.authService.verifyEmail(token, req);
    res.cookie(
      AUTH_COOKIE_NAME,
      data.access_token,
      buildAuthCookieOptions(this.configService),
    );
    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return {
      user: await this.appSettingsService.decorateUserPayload({
        ...data.user,
        appLockSessionUnlocked: false,
      }),
      access_token: data.access_token,
    };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('google/start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  googleStart(@Request() req, @Res() res: Response) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    if (!clientId) {
      return res.redirect(
        this.buildGoogleErrorRedirect(req, 'Google auth hali sozlanmagan'),
      );
    }

    const state = randomUUID();
    const redirectUri = this.buildGoogleRedirectUri(req);
    const mobileReturnUrl = this.getMobileGoogleReturnUrl(req);
    const isSecureCookie =
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('AUTH_COOKIE_SECURE') === 'true';

    res.cookie('jamm_google_oauth_state', state, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    if (mobileReturnUrl) {
      res.cookie('jamm_google_oauth_return', mobileReturnUrl, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
    } else {
      res.clearCookie('jamm_google_oauth_return', {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'lax',
        path: '/',
      });
    }

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('client_id', clientId);
    googleUrl.searchParams.set('redirect_uri', redirectUri);
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('scope', 'openid email profile');
    googleUrl.searchParams.set('prompt', 'select_account');
    googleUrl.searchParams.set('state', state);

    return res.redirect(googleUrl.toString());
  }

  @Get('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleCallback(@Request() req, @Res() res: Response) {
    const redirectUri = this.buildGoogleRedirectUri(req);
    const frontendError = (message: string) =>
      this.buildGoogleErrorRedirect(req, message);

    try {
      const stateCookie = extractCookieValue(
        req?.headers?.cookie || '',
        'jamm_google_oauth_state',
      );
      const mobileReturnUrl = extractCookieValue(
        req?.headers?.cookie || '',
        'jamm_google_oauth_return',
      );
      const stateParam = String(req.query?.state || '');
      const code = String(req.query?.code || '');

      res.clearCookie('jamm_google_oauth_state', {
        path: '/',
      });
      res.clearCookie('jamm_google_oauth_return', {
        path: '/',
      });

      if (!code) {
        return res.redirect(frontendError('Google auth kodi kelmadi'));
      }

      if (!stateCookie || !stateParam || stateCookie !== stateParam) {
        return res.redirect(frontendError('Google auth state mos kelmadi'));
      }

      const data = await this.authService.loginWithGoogleCode(
        code,
        redirectUri,
        req,
      );

      res.cookie(
        AUTH_COOKIE_NAME,
        data.access_token,
        buildAuthCookieOptions(this.configService),
      );
      res.clearCookie(
        APP_UNLOCK_COOKIE_NAME,
        buildAppUnlockCookieOptions(this.configService),
      );

      if (mobileReturnUrl && mobileReturnUrl.startsWith('jamm://')) {
        const separator = mobileReturnUrl.includes('?') ? '&' : '?';
        return res.redirect(
          `${mobileReturnUrl}${separator}access_token=${encodeURIComponent(data.access_token)}`,
        );
      }

      return res.redirect(this.buildFrontendRedirectUrl('/chats'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google auth xatosi';
      return res.redirect(frontendError(message));
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    const { password, __v, ...user } = req.user.toObject();
    return this.appSettingsService.decorateUserPayload({
      ...user,
      appLockSessionUnlocked: this.isAppUnlocked(req, user),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('mobile-session')
  async getMobileSession(@Request() req) {
    const { password, __v, ...user } = req.user.toObject();
    const accessToken = this.jwtService.sign({
      sub: String(user._id),
      email: user.email,
    });

    return {
      user: await this.appSettingsService.decorateUserPayload({
        ...user,
        appLockSessionUnlocked: this.isAppUnlocked(req, user),
      }),
      access_token: accessToken,
    };
  }

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async logout(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Delete session if tokenId is in JWT payload
    const rawToken = extractCookieValue(
      req?.headers?.cookie || '',
      AUTH_COOKIE_NAME,
    );
    if (rawToken) {
      try {
        const decoded = this.jwtService.decode(rawToken) as { tokenId?: string } | null;
        if (decoded?.tokenId) {
          void this.sessionService.deleteSessionByTokenId(decoded.tokenId);
        }
      } catch {
        // ignore
      }
    }

    res.clearCookie(
      AUTH_COOKIE_NAME,
      buildAuthCookieOptions(this.configService),
    );
    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return { success: true };
  }

  // ──────────────────────────────────────────────
  // Sessions endpoints
  // ──────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Request() req) {
    const userId = String(req.user._id);
    const sessions = await this.sessionService.getUserSessions(userId);

    // Identify current session from JWT
    let currentTokenId: string | null = null;
    const rawToken = extractCookieValue(
      req?.headers?.cookie || '',
      AUTH_COOKIE_NAME,
    );
    if (rawToken) {
      try {
        const decoded = this.jwtService.decode(rawToken) as { tokenId?: string } | null;
        currentTokenId = decoded?.tokenId || null;
      } catch {
        // ignore
      }
    }

    return sessions.map((s: any) => ({
      _id: s._id,
      deviceType: s.deviceType,
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      country: s.country,
      city: s.city,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      isCurrent: s.tokenId === currentTokenId,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async deleteSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = String(req.user._id);

    // Only allow deletion if current session is at least 1 day old
    // (the user opened a new session at least 1 day ago)
    const rawToken = extractCookieValue(
      req?.headers?.cookie || '',
      AUTH_COOKIE_NAME,
    );
    let currentTokenId: string | null = null;
    let currentSessionCreatedAt: Date | null = null;
    if (rawToken) {
      try {
        const decoded = this.jwtService.decode(rawToken) as { tokenId?: string } | null;
        currentTokenId = decoded?.tokenId || null;
      } catch {
        // ignore
      }
    }

    if (currentTokenId) {
      const allSessions = await this.sessionService.getUserSessions(userId);
      const current = (allSessions as any[]).find(
        (s) => s.tokenId === currentTokenId,
      );
      if (current) {
        currentSessionCreatedAt = current.createdAt as Date;
      }
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    const sessionAge = currentSessionCreatedAt
      ? Date.now() - new Date(currentSessionCreatedAt).getTime()
      : 0;

    if (sessionAge < oneDayMs) {
      throw new ForbiddenException(
        "Boshqa sessionlarni o'chirish uchun joriy sessioningiz kamida 1 kun bo'lishi kerak.",
      );
    }

    const deleted = await this.sessionService.deleteSession(sessionId, userId);
    if (!deleted) {
      throw new ForbiddenException("Session topilmadi yoki sizga tegishli emas.");
    }

    return { success: true };
  }
}
