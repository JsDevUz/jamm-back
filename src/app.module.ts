import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { ChatsModule } from './chats/chats.module';
import { VideoModule } from './video/video.module';
import { PresenceModule } from './presence/presence.module';
import { PremiumModule } from './premium/premium.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    CoursesModule,
    ChatsModule,
    VideoModule,
    PresenceModule,
    PremiumModule,
  ],
})
export class AppModule {}
