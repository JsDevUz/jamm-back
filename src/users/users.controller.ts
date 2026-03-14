import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
  Param,
  NotFoundException,
  BadRequestException,
  Post,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { UpdateProfileDecorationDto } from './dto/profile-decoration.dto';
import { SetAppLockDto } from './dto/set-app-lock.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
import { createSafeSingleFileMulterOptions } from '../common/uploads/multer-options';
import { APP_LIMITS } from '../common/limits/app-limits';
import { VerifyAppLockDto } from './dto/verify-app-lock.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  APP_UNLOCK_COOKIE_NAME,
  buildAppUnlockCookieOptions,
  getJwtSecret,
} from '../auth/auth-cookie.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly appSettingsService: AppSettingsService,
    private readonly uploadValidationService: UploadValidationService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private signAppUnlockToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, type: 'app-unlock' },
      {
        secret: getJwtSecret(this.configService),
        expiresIn: '7d',
      },
    );
  }

  private async sanitizeUser(user: any) {
    if (!user) return null;
    const obj = typeof user.toObject === 'function' ? user.toObject() : user;
    return this.appSettingsService.decorateUserPayload({
      _id: obj._id,
      jammId: obj.jammId,
      username: obj.username,
      nickname: obj.nickname,
      avatar: obj.avatar,
      phone: obj.phone,
      bio: obj.bio,
      gender: obj.gender,
      age: obj.age,
      selectedProfileDecorationId: obj.selectedProfileDecorationId || null,
      customProfileDecorationImage: obj.customProfileDecorationImage || null,
      interests: obj.interests || [],
      goals: obj.goals || [],
      level: obj.level,
      premiumStatus: obj.premiumStatus,
      premiumExpiresAt: obj.premiumExpiresAt,
      appLockEnabled: Boolean(obj.appLockEnabled),
      isOnboardingCompleted: obj.isOnboardingCompleted,
      isVerified: obj.isVerified,
      createdAt: obj.createdAt,
    });
  }

  @Post('avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Avatar',
    });
    const user = await this.usersService.updateAvatar(
      req.user._id.toString(),
      file,
    );
    return this.sanitizeUser(user);
  }

  @Post('upload-avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadAvatarOnly(
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Avatar',
    });
    return {
      avatar: await this.usersService.uploadAvatarOnly(file),
    };
  }

  /** Get the current user's profile */
  @Get('me')
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user._id.toString());
    return this.sanitizeUser(user);
  }

  @Get('me/app-lock')
  async getAppLockStatus(@Request() req) {
    return this.usersService.getAppLockStatus(req.user._id.toString());
  }

  @Post('me/app-lock')
  async setAppLock(@Request() req, @Body() body: SetAppLockDto) {
    return this.usersService.setAppLockPin(
      req.user._id.toString(),
      body.pin,
      body.currentPin,
    );
  }

  @Post('me/app-lock/verify')
  async verifyAppLock(
    @Request() req,
    @Body() body: VerifyAppLockDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.verifyAppLockPin(
      req.user._id.toString(),
      body.pin,
    );

    if (result?.valid) {
      const unlockToken = this.signAppUnlockToken(req.user._id.toString());
      res.cookie(
        APP_UNLOCK_COOKIE_NAME,
        unlockToken,
        buildAppUnlockCookieOptions(this.configService),
      );
      return { ...result, unlockToken };
    }

    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return result;
  }

  @Post('me/app-lock/remove')
  async removeAppLock(@Request() req, @Body() body: VerifyAppLockDto) {
    return this.usersService.removeAppLockPin(req.user._id.toString(), body.pin);
  }

  @Post('me/app-lock/logout-clear')
  async clearAppLockOnLogout(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return this.usersService.clearAppLockOnLogout(req.user._id.toString());
  }

  @Post('me/app-lock/lock-session')
  async lockAppSession(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(
      APP_UNLOCK_COOKIE_NAME,
      buildAppUnlockCookieOptions(this.configService),
    );
    return { locked: true };
  }

  /** Update the current user's profile */
  @Patch('me')
  async updateMe(@Request() req, @Body() body: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(
      req.user._id.toString(),
      body,
    );
    return this.sanitizeUser(user);
  }

  @Get('profile-decorations')
  async getProfileDecorations() {
    return this.usersService.getProfileDecorations();
  }

  @Patch('me/profile-decoration')
  async updateProfileDecoration(
    @Request() req,
    @Body() body: UpdateProfileDecorationDto,
  ) {
    const user = await this.usersService.updateProfileDecoration(
      req.user._id.toString(),
      body?.decorationId ?? null,
    );
    return this.sanitizeUser(user);
  }

  @Patch('me/profile-decoration-image')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadProfileDecorationImage(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Profil bezagi rasmi',
    });
    const user = await this.usersService.updateProfileDecorationImage(
      req.user._id.toString(),
      file,
    );
    return this.sanitizeUser(user);
  }

  /** Get all users (except current user) */
  @Get()
  async getAllUsers(@Request() req) {
    return this.usersService.getAllUsers(req.user._id.toString());
  }

  /** Search users (conversations) */
  @Get('search')
  async searchUsers(@Query('q') query: string, @Request() req) {
    if (!query) return [];
    return this.usersService.searchUsers(query, req.user._id);
  }

  /** Global user search (by username, nickname or jammId) */
  @Get('global-search')
  async searchGlobal(@Query('q') query: string, @Request() req) {
    if (!query) return [];
    const users = await this.usersService.searchGlobal(query, req.user._id);
    return Promise.all(users.map((u) => this.sanitizeUser(u)));
  }

  /** Get user by username */
  @Get('by-username/:username')
  async getUserByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const { password, ...safe } = (user as any).toObject();
    return this.appSettingsService.decorateUserPayload(safe);
  }

  /** Toggle follow/unfollow */
  @Post(':id/follow')
  async toggleFollow(@Request() req, @Param('id') id: string) {
    return this.usersService.toggleFollow(req.user._id.toString(), id);
  }

  /** Get public profile */
  @Get(':id/profile')
  async getPublicProfile(@Request() req, @Param('id') id: string) {
    return this.usersService.getPublicProfile(id, req.user._id.toString());
  }

  /** Check username availability (used during onboarding/signup) */
  @Get('check-username/:username')
  async checkUsername(@Request() req, @Param('username') username: string) {
    const existing = await this.usersService.findByUsername(username);
    // It's available if it doesn't exist or it belongs to the current user
    const isAvailable =
      !existing || existing._id.toString() === req.user._id.toString();
    return { available: isAvailable };
  }

  /** Complete onboarding */
  @Post('complete-onboarding')
  async completeOnboarding(
    @Request() req,
    @Body() body: CompleteOnboardingDto,
  ) {
    // Before completing, verify username doesn't exist for another user
    const existingUsername = await this.usersService.findByUsername(
      body.username,
    );
    if (
      existingUsername &&
      existingUsername._id.toString() !== req.user._id.toString()
    ) {
      throw new BadRequestException('Bu username allaqachon band');
    }
    const user = await this.usersService.completeOnboarding(
      req.user._id.toString(),
      body,
    );
    return this.sanitizeUser(user);
  }
}
