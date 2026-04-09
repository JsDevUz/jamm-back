import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VideoRecordingsService } from './video-recordings.service';

type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

@Controller('video')
export class VideoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly videoRecordingsService: VideoRecordingsService,
  ) {}

  private resolveRequestBaseUrl(req: any) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim();
    const forwardedHost = String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim();
    const protocol = forwardedProto || req.protocol || 'http';
    const host = forwardedHost || req.get?.('host') || req.headers.host || '';

    return host ? `${protocol}://${host}` : '';
  }

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
  @UseGuards(JwtAuthGuard)
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

  @Post('recordings/sessions')
  @UseGuards(JwtAuthGuard)
  async createRecordingSession(@Req() req: any, @Body() body: any) {
    return this.videoRecordingsService.createSession(req.user?._id, {
      kind: body?.kind,
      roomId: body?.roomId,
      mimeType: body?.mimeType,
      filename: body?.filename,
      apiBaseUrl: body?.apiBaseUrl || this.resolveRequestBaseUrl(req),
      appBaseUrl: body?.appBaseUrl,
    });
  }

  @Post('recordings/sessions/:sessionId/chunks')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: memoryStorage(),
      limits: { fileSize: 64 * 1024 * 1024 },
    }),
  )
  async uploadRecordingChunk(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('chunkIndex') chunkIndex: string,
  ) {
    if (!file) {
      throw new BadRequestException('Recording chunk topilmadi');
    }

    return this.videoRecordingsService.uploadChunk(sessionId, req.user?._id, {
      chunkIndex: Number(chunkIndex),
      file,
    });
  }

  @Post('recordings/sessions/:sessionId/finish')
  @UseGuards(JwtAuthGuard)
  async finishRecordingSession(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: any,
  ) {
    return this.videoRecordingsService.finishSession(sessionId, req.user?._id, {
      durationMs: Number(body?.durationMs) || 0,
    });
  }

  @Get('recordings/download/:publicId')
  async downloadRecording(
    @Param('publicId') publicId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const session = await this.videoRecordingsService.getDownloadableRecording(
      publicId,
      token,
    );
    const file = await this.videoRecordingsService.getRecordingFileStream(
      session,
    );

    res.setHeader('Content-Type', file.contentType || 'video/webm');
    res.setHeader('Content-Length', String(file.contentLength || 0));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(session.filename)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=60');

    const body = file.stream;
    if (typeof body?.pipe === 'function') {
      body.pipe(res);
      return;
    }

    if (typeof body?.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      res.end(Buffer.from(bytes));
      return;
    }

    res.end(body);
  }
}
