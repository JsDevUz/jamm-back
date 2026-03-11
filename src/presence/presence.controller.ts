import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisPresenceService } from './redis-presence.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { BulkStatusDto } from './dto/bulk-status.dto';

/**
 * REST API for querying user online/offline status.
 *
 * GET  /presence/status/:userId     — single user status
 * POST /presence/status/bulk        — batch status check
 */
@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(
    private readonly redisPresence: RedisPresenceService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('username')
      .lean()
      .exec();
    const officialProfile =
      await this.appSettingsService.getOfficialProfileByUsername(
        user?.username,
      );
    if (officialProfile?.hidePresence) {
      return { userId, online: false };
    }
    const online = await this.redisPresence.isOnline(userId);
    return { userId, online };
  }

  @Post('status/bulk')
  async getBulkStatus(@Body() body: BulkStatusDto) {
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];
    const users = await this.userModel
      .find({
        _id: {
          $in: userIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id)),
        },
      })
      .select('_id username')
      .lean()
      .exec();
    const decoratedUsers = await this.appSettingsService.decorateUsersPayload(
      users as any[],
    );
    const hiddenPresenceIds = new Set(
      decoratedUsers
        .filter((user: any) => user.hidePresence)
        .map((user: any) => String(user._id)),
    );

    const visibleUserIds = userIds.filter((id) => !hiddenPresenceIds.has(String(id)));
    const statuses = await this.redisPresence.getOnlineStatuses(visibleUserIds);
    hiddenPresenceIds.forEach((id) => {
      statuses[id] = false;
    });
    return { statuses };
  }
}
