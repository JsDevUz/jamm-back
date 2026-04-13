import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { LivekitService } from './livekit.service.js';
import { CreateLivekitTokenDto } from './dto/create-livekit-token.dto.js';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Get('config')
  getConfig() {
    return this.livekitService.getPublicConfig();
  }

  @Post('token')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  createToken(@Req() req, @Body() body: CreateLivekitTokenDto) {
    return this.livekitService.createToken(req.user, body);
  }
}
