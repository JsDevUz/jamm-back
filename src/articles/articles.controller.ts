import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArticlesService } from './articles.service';
import {
  ArticleCommentDto,
  ArticleReplyDto,
  UpsertArticleDto,
} from './dto/article.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
import { createSafeSingleFileMulterOptions } from '../common/uploads/multer-options';
import { APP_LIMITS } from '../common/limits/app-limits';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly uploadValidationService: UploadValidationService,
  ) {}

  @Post('upload-image')
  @Throttle({
    default: {
      limit: APP_LIMITS.articleUploadThrottleLimit,
      ttl: APP_LIMITS.articleUploadThrottleTtlMs,
    },
  })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.homeworkPhotoBytes),
    ),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    await this.uploadValidationService.validateImageUpload(file, {
      label: 'Maqola rasmi',
    });
    return this.articlesService.uploadImage(file);
  }

  @Post()
  createArticle(
    @Request() req,
    @Body() body: UpsertArticleDto,
  ) {
    return this.articlesService.createArticle(req.user._id.toString(), body);
  }

  @Patch(':id')
  updateArticle(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpsertArticleDto,
  ) {
    return this.articlesService.updateArticle(id, req.user._id.toString(), body);
  }

  @Get('user/:identifier')
  getUserArticles(@Request() req, @Param('identifier') identifier: string) {
    return this.articlesService.getUserArticles(identifier, req.user._id.toString());
  }

  @Get()
  getLatestArticles(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.articlesService.getLatestArticles(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || APP_LIMITS.articleFeedPageSize,
    });
  }

  @Get('liked')
  getLikedArticles(@Request() req) {
    return this.articlesService.getLikedArticles(req.user._id.toString());
  }

  @Get(':id/content')
  getArticleContent(@Param('id') id: string) {
    return this.articlesService.getArticleContent(id);
  }

  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.articlesService.getComments(id, {
      page: Number(page) || 1,
      limit: Number(limit) || APP_LIMITS.articleCommentsPageSize,
    });
  }

  @Get(':id')
  getArticle(@Request() req, @Param('id') id: string) {
    return this.articlesService.getArticle(id, req.user._id.toString());
  }

  @Post(':id/like')
  likeArticle(@Request() req, @Param('id') id: string) {
    return this.articlesService.likeArticle(id, req.user._id.toString());
  }

  @Post(':id/view')
  viewArticle(@Request() req, @Param('id') id: string) {
    return this.articlesService.viewArticle(id, req.user._id.toString());
  }

  @Post(':id/comments')
  addComment(
    @Request() req,
    @Param('id') id: string,
    @Body() body: ArticleCommentDto,
  ) {
    return this.articlesService.addComment(
      id,
      req.user._id.toString(),
      body.content,
    );
  }

  @Post(':id/comments/:commentId/reply')
  addReply(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ArticleReplyDto,
  ) {
    return this.articlesService.addReply(
      id,
      commentId,
      req.user._id.toString(),
      body.content,
      body.replyToUser,
    );
  }

  @Patch(':id/comments/:commentId')
  updateComment(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ArticleCommentDto,
  ) {
    return this.articlesService.updateComment(
      id,
      commentId,
      req.user._id.toString(),
      body.content,
    );
  }

  @Post(':id/comments/:commentId/update')
  updateCommentViaPost(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ArticleCommentDto,
  ) {
    return this.articlesService.updateComment(
      id,
      commentId,
      req.user._id.toString(),
      body.content,
    );
  }

  @Delete(':id/comments/:commentId')
  deleteComment(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.articlesService.deleteComment(
      id,
      commentId,
      req.user._id.toString(),
    );
  }

  @Post(':id/comments/:commentId/delete')
  deleteCommentViaPost(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.articlesService.deleteComment(
      id,
      commentId,
      req.user._id.toString(),
    );
  }

  @Delete(':id')
  deleteArticle(@Request() req, @Param('id') id: string) {
    return this.articlesService.deleteArticle(id, req.user._id.toString());
  }
}
