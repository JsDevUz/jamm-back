import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import {
  ProfileDecoration,
  ProfileDecorationSchema,
} from './schemas/profile-decoration.schema';
import { R2Service } from '../common/services/r2.service';
import { ChatsModule } from '../chats/chats.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ProfileDecoration.name, schema: ProfileDecorationSchema },
    ]),
    forwardRef(() => ChatsModule),
    AppSettingsModule,
  ],
  providers: [UsersService, R2Service],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
