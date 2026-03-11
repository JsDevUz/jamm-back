import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { BlogComment, BlogCommentSchema } from './schemas/blog-comment.schema';
import {
  BlogEngagement,
  BlogEngagementSchema,
} from './schemas/blog-engagement.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: BlogComment.name, schema: BlogCommentSchema },
      { name: BlogEngagement.name, schema: BlogEngagementSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BlogsController],
  providers: [BlogsService, R2Service],
  exports: [BlogsService],
})
export class BlogsModule {}
