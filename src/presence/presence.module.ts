import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { RedisPresenceService } from './redis-presence.service';
import { PresenceGateway } from './presence.gateway';
import { PresenceController } from './presence.controller';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret',
      }),
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [PresenceController],
  providers: [RedisPresenceService, PresenceGateway, WsJwtGuard],
  exports: [RedisPresenceService],
})
export class PresenceModule {}
