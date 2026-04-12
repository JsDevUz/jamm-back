import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { MeetsService } from '../meets/meets.service.js';
import { generateShortSlug } from '../common/utils/generate-short-slug.js';
import { CreateLivekitTokenDto } from './dto/create-livekit-token.dto.js';

type AuthenticatedUser = {
  _id?: string;
  email?: string;
  username?: string;
  nickname?: string;
};

@Injectable()
export class LivekitService {
  constructor(
    private readonly configService: ConfigService,
    private readonly meetsService: MeetsService,
  ) {}

  getPublicConfig() {
    return {
      url: this.getRequiredConfig('LIVEKIT_URL'),
    };
  }

  async createToken(user: AuthenticatedUser, payload: CreateLivekitTokenDto) {
    const roomId = String(payload.roomId || '').trim();
    const userId = String(user?._id || '').trim();

    if (!roomId) {
      throw new BadRequestException('Room ID topilmadi');
    }

    if (!userId) {
      throw new BadRequestException('Foydalanuvchi aniqlanmadi');
    }

    const meet = await this.meetsService.findByRoomId(roomId);
    const creatorId = this.normalizeMeetCreatorId(meet?.creator);

    if (meet?.isPrivate && creatorId && creatorId !== userId) {
      throw new ForbiddenException(
        'Private meet uchun LiveKit token faqat creator tomonidan olinadi',
      );
    }

    const participantName = this.resolveParticipantName(user, payload.participantName);
    const participantIdentity = `u-${userId}-${generateShortSlug(6)}`;
    const apiKey = this.getRequiredConfig('LIVEKIT_API_KEY');
    const apiSecret = this.getRequiredConfig('LIVEKIT_API_SECRET');
    const ttl = this.getTokenTtl();

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl,
      metadata: JSON.stringify({
        userId,
        roomId,
        creatorId: creatorId || null,
        isPrivate: Boolean(meet?.isPrivate),
      }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: payload.canPublish ?? true,
      canPublishData: payload.canPublishData ?? true,
      canSubscribe: payload.canSubscribe ?? true,
    });

    return {
      url: this.getRequiredConfig('LIVEKIT_URL'),
      roomId,
      token: await token.toJwt(),
      participantIdentity,
      participantName,
      isPrivate: Boolean(meet?.isPrivate),
      creatorId: creatorId || null,
    };
  }

  private resolveParticipantName(
    user: AuthenticatedUser,
    explicitName?: string,
  ): string {
    const directName = String(explicitName || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    if (directName) {
      return directName;
    }

    return (
      String(user?.nickname || '').trim() ||
      String(user?.username || '').trim() ||
      String(user?.email || '').trim() ||
      'User'
    ).slice(0, 80);
  }

  private normalizeMeetCreatorId(value: unknown): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      const candidate = (value as { _id?: unknown })._id;
      if (candidate) {
        return String(candidate);
      }
    }

    return String(value);
  }

  private getRequiredConfig(key: string): string {
    const value = String(this.configService.get<string>(key) || '').trim();
    if (!value) {
      throw new InternalServerErrorException(`${key} sozlanmagan`);
    }

    return value;
  }

  private getTokenTtl(): string {
    const rawValue = String(this.configService.get<string>('LIVEKIT_TOKEN_TTL') || '').trim();
    return rawValue || '2h';
  }
}
