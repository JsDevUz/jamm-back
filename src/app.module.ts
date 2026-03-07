import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { ChatsModule } from './chats/chats.module';
import { VideoModule } from './video/video.module';
import { PresenceModule } from './presence/presence.module';
import { PremiumModule } from './premium/premium.module';
import { MeetsModule } from './meets/meets.module';
import { PostsModule } from './posts/posts.module';
import { ArenaModule } from './arena/arena.module';
import { BlogsModule } from './blogs/blogs.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { AppAccessGuard } from './auth/guards/app-access.guard';

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
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    CoursesModule,
    ChatsModule,
    VideoModule,
    PresenceModule,
    PremiumModule,
    MeetsModule,
    PostsModule,
    ArenaModule,
    BlogsModule,
    AppSettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppAccessGuard,
    },
  ],
})
export class AppModule {}
