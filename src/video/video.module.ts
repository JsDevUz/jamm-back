import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { VideoGateway } from './video.gateway';
import { PremiumModule } from '../premium/premium.module';
import { getJwtSecret } from '../auth/auth-cookie.util';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
      }),
    }),
    PremiumModule,
  ],
  providers: [VideoGateway],
})
export class VideoModule {}
