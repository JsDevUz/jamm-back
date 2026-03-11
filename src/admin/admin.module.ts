import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { JwtModule } from '@nestjs/jwt';
import { Chat, ChatSchema } from '../chats/schemas/chat.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import {
  CourseMemberRecord,
  CourseMemberRecordSchema,
} from '../courses/schemas/course-member.schema';
import { PremiumModule } from '../premium/premium.module';
import { PromoCode, PromoCodeSchema } from '../premium/schemas/promo-code.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CeoGuard } from './guards/ceo.guard';

@Module({
  imports: [
    JwtModule,
    PremiumModule,
    AppSettingsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseMemberRecord.name, schema: CourseMemberRecordSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, CeoGuard],
})
export class AdminModule {}
