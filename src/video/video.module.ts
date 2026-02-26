import { Module } from '@nestjs/common';
import { VideoGateway } from './video.gateway';

@Module({
  providers: [VideoGateway],
})
export class VideoModule {}
