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
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlogsService } from './blogs.service';

@Controller('blogs')
@UseGuards(JwtAuthGuard)
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.blogsService.uploadImage(file);
  }

  @Post()
  createBlog(
    @Request() req,
    @Body()
    body: {
      title: string;
      markdown: string;
      excerpt?: string;
      coverImage?: string;
      tags?: string[];
    },
  ) {
    return this.blogsService.createBlog(req.user._id.toString(), body);
  }

  @Patch(':id')
  updateBlog(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      markdown: string;
      excerpt?: string;
      coverImage?: string;
      tags?: string[];
    },
  ) {
    return this.blogsService.updateBlog(id, req.user._id.toString(), body);
  }

  @Get('user/:identifier')
  getUserBlogs(@Request() req, @Param('identifier') identifier: string) {
    return this.blogsService.getUserBlogs(identifier, req.user._id.toString());
  }

  @Get()
  getLatestBlogs(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.blogsService.getLatestBlogs(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('liked')
  getLikedBlogs(@Request() req) {
    return this.blogsService.getLikedBlogs(req.user._id.toString());
  }

  @Get(':id/content')
  getBlogContent(@Param('id') id: string) {
    return this.blogsService.getBlogContent(id);
  }

  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.blogsService.getComments(id, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }

  @Get(':id')
  getBlog(@Request() req, @Param('id') id: string) {
    return this.blogsService.getBlog(id, req.user._id.toString());
  }

  @Post(':id/like')
  likeBlog(@Request() req, @Param('id') id: string) {
    return this.blogsService.likeBlog(id, req.user._id.toString());
  }

  @Post(':id/view')
  viewBlog(@Request() req, @Param('id') id: string) {
    return this.blogsService.viewBlog(id, req.user._id.toString());
  }

  @Post(':id/comments')
  addComment(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.blogsService.addComment(
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
    @Body() body: { content: string; replyToUser?: string },
  ) {
    return this.blogsService.addReply(
      id,
      commentId,
      req.user._id.toString(),
      body.content,
      body.replyToUser,
    );
  }

  @Delete(':id')
  deleteBlog(@Request() req, @Param('id') id: string) {
    return this.blogsService.deleteBlog(id, req.user._id.toString());
  }
}
