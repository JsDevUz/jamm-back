import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../common/services/email.service';
import { getJwtSecret } from './auth-cookie.util';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { Session, SessionSchema } from './schemas/session.schema';
import { SessionService } from './session.service';

@Module({
  imports: [
    UsersModule,
    AppSettingsModule,
    PassportModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: { expiresIn: 604800 }, // 7 days in seconds
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService, SessionService],
  exports: [AuthService, JwtModule, SessionService],
})
export class AuthModule {}
