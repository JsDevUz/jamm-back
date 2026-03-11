import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ChatsGateway } from './chats.gateway';
import { PresenceModule } from '../presence/presence.module';
import { R2Service } from '../common/services/r2.service';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { PremiumModule } from '../premium/premium.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { getJwtSecret } from '../auth/auth-cookie.util';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
      }),
    }),
    forwardRef(() => PresenceModule),
    EncryptionModule,
    PremiumModule,
    AppSettingsModule,
  ],
  providers: [ChatsService, ChatsGateway, R2Service],
  controllers: [ChatsController],
  exports: [ChatsService],
})
export class ChatsModule {}
