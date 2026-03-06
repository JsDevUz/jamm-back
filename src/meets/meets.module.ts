import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetsService } from './meets.service.js';
import { MeetsController } from './meets.controller.js';
import { Meet, MeetSchema } from './schemas/meet.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meet.name, schema: MeetSchema }]),
  ],
  providers: [MeetsService],
  controllers: [MeetsController],
  exports: [MeetsService],
})
export class MeetsModule {}
