import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

@Controller('video')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private readonly configService: ConfigService) {}

  private getTurnUrls(): string[] {
    return (this.configService.get<string>('TURN_URLS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private buildDynamicTurnCredentials(userId: string | undefined) {
    const turnAuthSecret = this.configService.get<string>('TURN_AUTH_SECRET');
    if (!turnAuthSecret || !userId) {
      return null;
    }

    const ttlSeconds = Number(
      this.configService.get<string>('TURN_TTL_SECONDS') || 3600,
    );
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresAt}:${userId}`;
    const credential = createHmac('sha1', turnAuthSecret)
      .update(username)
      .digest('base64');

    return { username, credential };
  }

  @Get('ice-config')
  getIceConfig(@Req() req: any) {
    const iceServers: IceServerConfig[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrls = this.getTurnUrls();
    if (turnUrls.length === 0) {
      return { iceServers };
    }

    const dynamicCredentials = this.buildDynamicTurnCredentials(req.user?._id);
    const staticUsername = this.configService.get<string>('TURN_USERNAME');
    const staticCredential = this.configService.get<string>('TURN_CREDENTIAL');

    if (dynamicCredentials) {
      iceServers.push({
        urls: turnUrls,
        username: dynamicCredentials.username,
        credential: dynamicCredentials.credential,
      });
    } else if (staticUsername && staticCredential) {
      iceServers.push({
        urls: turnUrls,
        username: staticUsername,
        credential: staticCredential,
      });
    }

    return { iceServers };
  }
}
