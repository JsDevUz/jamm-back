import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisPresenceService } from './redis-presence.service';

/**
 * REST API for querying user online/offline status.
 *
 * GET  /presence/status/:userId     — single user status
 * POST /presence/status/bulk        — batch status check
 */
@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly redisPresence: RedisPresenceService) {}

  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string) {
    const online = await this.redisPresence.isOnline(userId);
    return { userId, online };
  }

  @Post('status/bulk')
  async getBulkStatus(@Body() body: { userIds: string[] }) {
    const statuses = await this.redisPresence.getOnlineStatuses(
      body.userIds || [],
    );
    return { statuses };
  }
}
