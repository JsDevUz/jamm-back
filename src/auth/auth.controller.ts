import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
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

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private appSettingsService: AppSettingsService,
    private jwtService: JwtService,
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
  ) {
    const data = await this.authService.login(loginDto);
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
    const data = await this.authService.verifyEmail(token);
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
        this.buildFrontendRedirectUrl(
          `/login?google_error=${encodeURIComponent('Google auth hali sozlanmagan')}`,
        ),
      );
    }

    const state = randomUUID();
    const redirectUri = this.buildGoogleRedirectUri(req);

    res.cookie('jamm_google_oauth_state', state, {
      httpOnly: true,
      secure:
        this.configService.get<string>('NODE_ENV') === 'production' ||
        this.configService.get<string>('AUTH_COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

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
      this.buildFrontendRedirectUrl(
        `/login?google_error=${encodeURIComponent(message)}`,
      );

    try {
      const stateCookie = extractCookieValue(
        req?.headers?.cookie || '',
        'jamm_google_oauth_state',
      );
      const stateParam = String(req.query?.state || '');
      const code = String(req.query?.code || '');

      res.clearCookie('jamm_google_oauth_state', {
        path: '/',
      });

      if (!code) {
        return res.redirect(frontendError('Google auth kodi kelmadi'));
      }

      if (!stateCookie || !stateParam || stateCookie !== stateParam) {
        return res.redirect(frontendError('Google auth state mos kelmadi'));
      }

      const data = await this.authService.loginWithGoogleCode(code, redirectUri);

      res.cookie(
        AUTH_COOKIE_NAME,
        data.access_token,
        buildAuthCookieOptions(this.configService),
      );
      res.clearCookie(
        APP_UNLOCK_COOKIE_NAME,
        buildAppUnlockCookieOptions(this.configService),
      );

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

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async logout(@Res({ passthrough: true }) res: Response) {
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
}
