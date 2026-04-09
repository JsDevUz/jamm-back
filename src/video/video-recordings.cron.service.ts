import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { VideoRecordingsService } from './video-recordings.service';

@Injectable()
export class VideoRecordingsCronService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VideoRecordingsCronService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly videoRecordingsService: VideoRecordingsService,
  ) {}

  onModuleInit() {
    void this.runTick();
    this.interval = setInterval(() => {
      void this.runTick();
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async runTick() {
    try {
      await this.videoRecordingsService.finalizeStaleSessions();
      await this.videoRecordingsService.cleanupExpiredRecordings();
    } catch (error) {
      this.logger.error('Recording cron tick failed', error as any);
    }
  }
}
