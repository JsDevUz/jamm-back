import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post, PostSchema } from './schemas/post.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import {
  PostEngagement,
  PostEngagementSchema,
} from './schemas/post-engagement.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { getJwtSecret } from '../auth/auth-cookie.util';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
      { name: PostEngagement.name, schema: PostEngagementSchema },
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
    EncryptionModule,
  ],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
