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
  UseInterceptors,
  UploadedFile,
  Res,
  Headers,
  ForbiddenException,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2Service } from '../common/services/r2.service';
import type { Response } from 'express';

@Controller('courses')
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private r2Service: R2Service,
  ) {}

  /* ---- COURSES ---- */

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.coursesService.getAllCoursesForUser(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 15,
    });
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

  @UseGuards(JwtAuthGuard)
  @Post('upload-media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    // Generate an R2 key (URL) for this file
    const fileUrl = await this.r2Service.uploadFile(file, 'courses');
    return {
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/stream')
  async streamLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    // 1. Verify user access
    const course = await this.coursesService.findById(id);
    if (!course) throw new NotFoundException('Course not found');

    let hasAccess = false;
    const currentUserId = req.user._id.toString();

    if (course.createdBy.toString() === currentUserId) {
      hasAccess = true;
    } else {
      const isApproved = course.members.some(
        (m: any) =>
          m.userId.toString() === currentUserId && m.status === 'approved',
      );
      if (isApproved) hasAccess = true;
    }

    if (!hasAccess) {
      // Is it a preview lesson?
      const previewLessonIndex = course.lessons.findIndex(
        (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
      );
      if (previewLessonIndex !== 0) {
        throw new ForbiddenException("Darsni ko'rish huquqi yo'q");
      }
    }

    // 2. Fetch lesson
    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );
    if (!lesson) throw new NotFoundException('Lesson not found');

    if (!lesson.videoUrl && !lesson.fileUrl) {
      throw new NotFoundException('Fayl yoki video topilmadi');
    }

    const keyToStream = lesson.fileUrl || lesson.videoUrl;

    // 3. Obtain R2 stream
    const r2Data = await this.r2Service.getFileStream(keyToStream, range);

    // 4. Send responsive headers
    const headers: any = {
      'Content-Type': r2Data.contentType,
      'Content-Length': r2Data.contentLength,
      'Accept-Ranges': 'bytes',
    };

    if (r2Data.contentRange) {
      headers['Content-Range'] = r2Data.contentRange;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    // Pipe directly to express response
    r2Data.stream.pipe(res);
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
  @Get(':id/lessons/:lessonId/comments')
  getComments(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.coursesService.getLessonComments(id, lessonId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }

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
