import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DeletePostImageDto,
  PostContentDto,
  PostReplyDto,
  UpsertPostDto,
} from './dto/post.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
import { createSafeSingleFileMulterOptions } from '../common/uploads/multer-options';
import { APP_LIMITS } from '../common/limits/app-limits';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly uploadValidationService: UploadValidationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.postImageBytes),
    ),
  )
  async uploadImage(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Rasm topilmadi');
    }

    await this.uploadValidationService.validateImageUpload(file, {
      maxBytes: APP_LIMITS.postImageBytes,
      label: 'Gurung rasmi',
    });

    return this.postsService.uploadImage(req.user._id.toString(), file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('upload-image')
  deleteUploadedImage(@Request() req, @Body() body: DeletePostImageDto) {
    return this.postsService.deleteUploadedImage(
      req.user._id.toString(),
      body.url,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createPost(@Request() req, @Body() body: UpsertPostDto) {
    return this.postsService.createPost(req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updatePost(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpsertPostDto,
  ) {
    return this.postsService.updatePost(id, req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  getFeed(
    @Request() req,
    @Query('type') type: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getFeed(
      req.user._id.toString(),
      type || 'foryou',
      {
        page: Number(page) || 1,
        limit: Number(limit) || 15,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  getUserPosts(@Request() req, @Param('userId') userId: string) {
    return this.postsService.getUserPosts(userId, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get('liked')
  getLikedPosts(@Request() req) {
    return this.postsService.getLikedPosts(req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  likePost(@Request() req, @Param('id') id: string) {
    return this.postsService.likePost(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/view')
  viewPost(@Request() req, @Param('id') id: string) {
    return this.postsService.viewPost(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  addComment(
    @Request() req,
    @Param('id') id: string,
    @Body() body: PostContentDto,
  ) {
    return this.postsService.addComment(
      id,
      req.user._id.toString(),
      body.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments/:commentId/reply')
  addReply(
    @Request() req,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: PostReplyDto,
  ) {
    return this.postsService.addReply(
      id,
      commentId,
      req.user._id.toString(),
      body.content,
      body.replyToUser,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.postsService.getComments(id, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deletePost(@Request() req, @Param('id') id: string) {
    return this.postsService.deletePost(id, req.user._id.toString());
  }
}
