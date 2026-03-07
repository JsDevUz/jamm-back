import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetsService } from './meets.service.js';
import { MeetsController } from './meets.controller.js';
import { Meet, MeetSchema } from './schemas/meet.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meet.name, schema: MeetSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [MeetsService],
  controllers: [MeetsController],
  exports: [MeetsService],
})
export class MeetsModule {}
