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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Post, UseInterceptors, UploadedFile } from '@nestjs/common';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(req.user._id.toString(), file);
  }

  /** Get the current user's profile */
  @Get('me')
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user._id.toString());
    if (!user) return null;
    const { password, ...safe } = (user as any).toObject();
    return safe;
  }

  /** Update the current user's profile */
  @Patch('me')
  async updateMe(
    @Request() req,
    @Body()
    body: {
      nickname?: string;
      username?: string;
      phone?: string;
      avatar?: string;
    },
  ) {
    return this.usersService.updateProfile(req.user._id.toString(), body);
  }

  /** Search users */
  @Get('search')
  async searchUsers(@Query('q') query: string, @Request() req) {
    if (!query) return [];
    return this.usersService.searchUsers(query, req.user._id);
  }

  /** Get user by username */
  @Get('by-username/:username')
  async getUserByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const { password, ...safe } = (user as any).toObject();
    return safe;
  }
}
