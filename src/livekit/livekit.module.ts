import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetsModule } from '../meets/meets.module.js';
import { LivekitController } from './livekit.controller.js';
import { LivekitService } from './livekit.service.js';

@Module({
  imports: [ConfigModule, MeetsModule],
  controllers: [LivekitController],
  providers: [LivekitService],
  exports: [LivekitService],
})
export class LivekitModule {}
