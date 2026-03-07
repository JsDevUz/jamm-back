import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BlogsController],
  providers: [BlogsService, R2Service],
  exports: [BlogsService],
})
export class BlogsModule {}
