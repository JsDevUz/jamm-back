import {
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
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostContentDto, PostReplyDto } from './dto/post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createPost(@Request() req, @Body() body: PostContentDto) {
    return this.postsService.createPost(req.user._id.toString(), body.content);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updatePost(
    @Request() req,
    @Param('id') id: string,
    @Body() body: PostContentDto,
  ) {
    return this.postsService.updatePost(
      id,
      req.user._id.toString(),
      body.content,
    );
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
