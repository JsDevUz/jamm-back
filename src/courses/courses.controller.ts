import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('courses')
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  /* ---- COURSES ---- */

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.coursesService.getAllCoursesForUser(req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.coursesService.getCourseForUser(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Request() req,
    @Body()
    body: {
      name: string;
      description?: string;
      image?: string;
      category?: string;
      price?: number;
    },
  ) {
    return this.coursesService.create(req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.coursesService.delete(id, req.user._id.toString());
  }

  /* ---- LESSONS ---- */

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons')
  addLesson(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { title: string; videoUrl: string; description?: string },
  ) {
    return this.coursesService.addLesson(id, req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/lessons/:lessonId')
  removeLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.removeLesson(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/views')
  incrementViews(@Param('id') id: string, @Param('lessonId') lessonId: string) {
    return this.coursesService.incrementViews(id, lessonId);
  }

  /* ---- ENROLLMENT ---- */

  @UseGuards(JwtAuthGuard)
  @Post(':id/enroll')
  enroll(@Request() req, @Param('id') id: string) {
    return this.coursesService.enroll(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:memberId/approve')
  approveUser(
    @Request() req,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.coursesService.approveUser(
      id,
      memberId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:memberId')
  removeUser(
    @Request() req,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.coursesService.removeUser(
      id,
      memberId,
      req.user._id.toString(),
    );
  }

  /* ---- COMMENTS ---- */

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons/:lessonId/comments')
  addComment(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: { text: string },
  ) {
    return this.coursesService.addComment(id, lessonId, req.user, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons/:lessonId/comments/:commentId/replies')
  addReply(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('commentId') commentId: string,
    @Body() body: { text: string },
  ) {
    return this.coursesService.addReply(
      id,
      lessonId,
      commentId,
      req.user,
      body.text,
    );
  }
}
