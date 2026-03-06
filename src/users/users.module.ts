import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => ChatsModule),
  ],
  providers: [UsersService, R2Service],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
