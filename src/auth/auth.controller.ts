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
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookieOptions,
} from './auth-cookie.util';
import { ConfigService } from '@nestjs/config';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private appSettingsService: AppSettingsService,
  ) {}

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
    return {
      user: await this.appSettingsService.decorateUserPayload(data.user),
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
    return {
      user: await this.appSettingsService.decorateUserPayload(data.user),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    const { password, __v, ...user } = req.user.toObject();
    return this.appSettingsService.decorateUserPayload(user);
  }

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(
      AUTH_COOKIE_NAME,
      buildAuthCookieOptions(this.configService),
    );
    return { success: true };
  }
}
