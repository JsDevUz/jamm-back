import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoController } from './video.controller';
import { VideoGateway } from './video.gateway';
import { VideoRecordingsService } from './video-recordings.service';
import { VideoRecordingsCronService } from './video-recordings.cron.service';
import { PremiumModule } from '../premium/premium.module';
import { getJwtSecret } from '../auth/auth-cookie.util';
import { Chat, ChatSchema } from '../chats/schemas/chat.schema';
import { VideoRecording, VideoRecordingSchema } from './schemas/video-recording.schema';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: VideoRecording.name, schema: VideoRecordingSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
      }),
    }),
    PremiumModule,
    ChatsModule,
  ],
  controllers: [VideoController],
  providers: [
    VideoGateway,
    VideoRecordingsService,
    VideoRecordingsCronService,
  ],
})
export class VideoModule {}
