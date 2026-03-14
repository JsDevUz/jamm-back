import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { Article, ArticleSchema } from './schemas/article.schema';
import { ArticleComment, ArticleCommentSchema } from './schemas/article-comment.schema';
import {
  ArticleEngagement,
  ArticleEngagementSchema,
} from './schemas/article-engagement.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: ArticleComment.name, schema: ArticleCommentSchema },
      { name: ArticleEngagement.name, schema: ArticleEngagementSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService, R2Service],
  exports: [ArticlesService],
})
export class ArticlesModule {}
