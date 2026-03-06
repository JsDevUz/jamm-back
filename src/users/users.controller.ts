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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private sanitizeUser(user: any) {
    if (!user) return null;
    const obj = typeof user.toObject === 'function' ? user.toObject() : user;
    return {
      _id: obj._id,
      jammId: obj.jammId,
      username: obj.username,
      nickname: obj.nickname,
      avatar: obj.avatar,
      phone: obj.phone,
      bio: obj.bio,
      gender: obj.gender,
      age: obj.age,
      interests: obj.interests || [],
      goals: obj.goals || [],
      level: obj.level,
      premiumStatus: obj.premiumStatus,
      premiumExpiresAt: obj.premiumExpiresAt,
      isOnboardingCompleted: obj.isOnboardingCompleted,
      isVerified: obj.isVerified,
      createdAt: obj.createdAt,
    };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = await this.usersService.updateAvatar(
      req.user._id.toString(),
      file,
    );
    return this.sanitizeUser(user);
  }

  /** Get the current user's profile */
  @Get('me')
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user._id.toString());
    return this.sanitizeUser(user);
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
    return users.map((u) => this.sanitizeUser(u));
  }

  /** Get user by username */
  @Get('by-username/:username')
  async getUserByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const { password, ...safe } = (user as any).toObject();
    return safe;
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
