import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
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

  private canViewLastSeen(user?: {
    premiumStatus?: string | null;
    premiumExpiresAt?: Date | string | null;
  }) {
    if (user?.premiumStatus !== 'active' || !user?.premiumExpiresAt) {
      return false;
    }

    const expiresAt = new Date(user.premiumExpiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
  }

  private toIsoDate(value?: Date | string | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string, @Request() req) {
    const user = await this.userModel
      .findById(userId)
      .select('username lastSeen')
      .lean()
      .exec();
    const officialProfile =
      await this.appSettingsService.getOfficialProfileByUsername(
        user?.username,
      );
    if (officialProfile?.hidePresence) {
      return { userId, online: false, lastSeen: null };
    }

    const online = await this.redisPresence.isOnline(userId);
    const canViewLastSeen = this.canViewLastSeen(req.user);
    return {
      userId,
      online,
      lastSeen: !online && canViewLastSeen ? this.toIsoDate(user?.lastSeen) : null,
    };
  }

  @Post('status/bulk')
  async getBulkStatus(@Body() body: BulkStatusDto, @Request() req) {
    const requestedUserIds = Array.from(
      new Set(
        (Array.isArray(body.userIds) ? body.userIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );
    const users = await this.userModel
      .find({
        _id: {
          $in: requestedUserIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id)),
        },
      })
      .select('_id username lastSeen')
      .lean()
      .exec();
    const decoratedUsers = await this.appSettingsService.decorateUsersPayload(
      users as any[],
    );
    const canViewLastSeen = this.canViewLastSeen(req.user);
    const snapshots: Record<
      string,
      { online: boolean; lastSeen: string | null }
    > = {};

    requestedUserIds.forEach((id) => {
      snapshots[id] = {
        online: false,
        lastSeen: null,
      };
    });

    const hiddenPresenceIds = new Set(
      decoratedUsers
        .filter((user: any) => user.hidePresence)
        .map((user: any) => String(user._id)),
    );

    const visibleUsers = decoratedUsers.filter(
      (user: any) => !hiddenPresenceIds.has(String(user._id)),
    );
    const visibleUserIds = visibleUsers.map((user: any) => String(user._id));
    const statuses = await this.redisPresence.getOnlineStatuses(visibleUserIds);

    visibleUsers.forEach((user: any) => {
      const id = String(user._id);
      const online = Boolean(statuses[id]);
      snapshots[id] = {
        online,
        lastSeen: !online && canViewLastSeen ? this.toIsoDate(user.lastSeen) : null,
      };
    });

    return { statuses: snapshots };
  }
}
