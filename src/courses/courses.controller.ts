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
  UnauthorizedException,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2Service } from '../common/services/r2.service';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Controller('courses')
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private r2Service: R2Service,
    private jwtService: JwtService,
  ) {}

  private buildUserAgentHash(userAgent?: string) {
    return createHash('sha256')
      .update(userAgent || 'unknown-agent')
      .digest('hex')
      .slice(0, 24);
  }

  private getMimeType(fileName: string) {
    const extension = extname(fileName).toLowerCase();
    switch (extension) {
      case '.m3u8':
        return 'application/vnd.apple.mpegurl';
      case '.ts':
        return 'video/mp2t';
      case '.m4s':
        return 'video/iso.segment';
      case '.mp4':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }

  private getAssetFileName(assetKey: string) {
    return basename(String(assetKey || '').split('?')[0]);
  }

  private async transcodeVideoToHls(file: Express.Multer.File) {
    const tempRoot = await mkdtemp(join(tmpdir(), 'jamm-hls-'));
    const inputPath = join(
      tempRoot,
      `input${extname(file.originalname || '') || '.mp4'}`,
    );
    const outputDir = join(tempRoot, 'output');
    const playlistName = 'master.m3u8';
    const playlistPath = join(outputDir, playlistName);
    const assetFolder = `courses/hls/${randomUUID()}`;
    const keyFileName = 'enc.key';
    const keyUriPlaceholder = '__JAMM_HLS_KEY_URI__';
    const keyPath = join(tempRoot, keyFileName);
    const keyInfoPath = join(tempRoot, 'enc.keyinfo');
    const keyBuffer = randomBytes(16);
    const keyIvHex = randomBytes(16).toString('hex');

    try {
      await writeFile(inputPath, file.buffer);
      await mkdir(outputDir, { recursive: true });
      await writeFile(keyPath, keyBuffer);
      await writeFile(
        keyInfoPath,
        `${keyUriPlaceholder}\n${keyPath}\n${keyIvHex}\n`,
      );

      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_flags',
        'independent_segments',
        '-hls_key_info_file',
        keyInfoPath,
        '-hls_segment_filename',
        join(outputDir, 'segment_%03d.ts'),
        playlistPath,
      ]);

      const fileNames = (await readdir(outputDir)).sort();
      const assetKeys: string[] = [];

      const keyAsset = `${assetFolder}/${keyFileName}`;
      await this.r2Service.uploadBuffer(
        keyBuffer,
        keyAsset,
        'application/octet-stream',
      );

      for (const fileName of fileNames) {
        const filePath = join(outputDir, fileName);
        const key = `${assetFolder}/${fileName}`;
        await this.r2Service.uploadBuffer(
          await readFile(filePath),
          key,
          this.getMimeType(fileName),
        );
        assetKeys.push(key);
      }

      return {
        streamType: 'hls' as const,
        manifestUrl: `${assetFolder}/${playlistName}`,
        assetKeys,
        hlsKeyAsset: keyAsset,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  private getPlaybackCookieName() {
    return 'jamm_course_playback';
  }

  private readCookie(req: ExpressRequest, name: string) {
    const raw = req.headers.cookie;
    if (!raw) return null;
    const match = raw
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  }

  private buildPlaybackHeaders(base: Record<string, any> = {}) {
    return {
      ...base,
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-site',
    };
  }

  private async getAuthorizedLessonForUser(
    courseId: string,
    lessonId: string,
    userId: string,
  ) {
    const course = await this.coursesService.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    let hasAccess = false;

    if (course.createdBy.toString() === userId) {
      hasAccess = true;
    } else {
      const isApproved = course.members.some(
        (m: any) => m.userId.toString() === userId && m.status === 'approved',
      );
      if (isApproved) hasAccess = true;
    }

    if (!hasAccess) {
      const previewLessonIndex = course.lessons.findIndex(
        (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
      );
      if (previewLessonIndex !== 0) {
        throw new ForbiddenException("Darsni ko'rish huquqi yo'q");
      }
    }

    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );
    if (!lesson) throw new NotFoundException('Lesson not found');

    if (!lesson.videoUrl && !lesson.fileUrl) {
      throw new NotFoundException('Fayl yoki video topilmadi');
    }

    return {
      course,
      lesson,
      keyToStream: lesson.fileUrl || lesson.videoUrl,
    };
  }

  private async resolvePlaybackUserId(
    req: any,
    courseId: string,
    lessonId: string,
    playbackToken?: string,
  ) {
    const cookieToken =
      playbackToken || this.readCookie(req, this.getPlaybackCookieName());

    if (cookieToken) {
      try {
        const payload = await this.jwtService.verifyAsync(cookieToken);
        const expectedUaHash = this.buildUserAgentHash(
          req.headers['user-agent'],
        );

        if (
          payload?.type !== 'course-playback' ||
          payload?.courseId !== courseId ||
          payload?.lessonId !== lessonId ||
          payload?.uaHash !== expectedUaHash
        ) {
          throw new UnauthorizedException('Invalid playback token');
        }

        return payload.sub as string;
      } catch (error) {
        throw new UnauthorizedException('Playback token yaroqsiz yoki eskirgan');
      }
    }

    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!bearerToken) {
      throw new UnauthorizedException('Autentifikatsiya talab qilinadi');
    }

    try {
      const payload = await this.jwtService.verifyAsync(bearerToken);
      return payload.sub as string;
    } catch (error) {
      throw new UnauthorizedException('Autentifikatsiya xato');
    }
  }

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
  @Get('liked-lessons')
  getLikedLessons(@Request() req) {
    return this.coursesService.getLikedLessons(req.user._id.toString());
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
    @Body()
    body: {
      title: string;
      videoUrl?: string;
      description?: string;
      type?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      streamType?: string;
      streamAssets?: string[];
      hlsKeyAsset?: string;
    },
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
  @Post(':id/lessons/:lessonId/like')
  likeLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.toggleLessonLike(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }


  @UseGuards(JwtAuthGuard)
  @Post('upload-media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    if (file?.mimetype?.startsWith('video/')) {
      return this.transcodeVideoToHls(file);
    }

    const fileUrl = await this.r2Service.uploadFile(file, 'courses');
    return {
      streamType: 'direct',
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      hlsKeyAsset: '',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/playback-token')
  async getLessonPlaybackToken(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { lesson } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      req.user._id.toString(),
    );

    const token = await this.jwtService.signAsync(
      {
        sub: req.user._id.toString(),
        courseId: id,
        lessonId,
        type: 'course-playback',
        uaHash: this.buildUserAgentHash(userAgent),
      },
      { expiresIn: '2h' },
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(this.getPlaybackCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 2,
      path: `/courses/${id}/lessons/${lessonId}`,
    });

    const isHlsLesson =
      lesson.streamType === 'hls' || lesson.videoUrl?.endsWith('.m3u8');
    const manifestName = this.getAssetFileName(lesson.videoUrl);

    return {
      expiresIn: 60 * 60 * 2,
      streamType: isHlsLesson ? 'hls' : 'direct',
      streamUrl: isHlsLesson
        ? `/courses/${id}/lessons/${lessonId}/hls/${manifestName}`
        : `/courses/${id}/lessons/${lessonId}/stream`,
    };
  }

  @Get(':id/lessons/:lessonId/hls/:asset')
  async streamLessonHlsAsset(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('asset') asset: string,
    @Headers('range') range: string,
    @Res() res: Response,
    @Query('playbackToken') playbackToken?: string,
  ) {
    const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
    if (fetchDest === 'document' || fetchDest === 'iframe') {
      throw new ForbiddenException(
        "Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi",
      );
    }

    const currentUserId = await this.resolvePlaybackUserId(
      req,
      id,
      lessonId,
      playbackToken,
    );
    const { lesson } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
    );

    const assetKey = [lesson.videoUrl, ...(lesson.streamAssets || [])].find(
      (key: string) => this.getAssetFileName(key) === asset,
    );
    if (!assetKey) {
      throw new NotFoundException('HLS asset topilmadi');
    }

    if (asset.endsWith('.m3u8')) {
      const manifest = await this.r2Service.getFileText(assetKey);
      const keyPath = `/courses/${id}/lessons/${lessonId}/hls-key`;
      const resolvedManifest = manifest.replaceAll(
        '__JAMM_HLS_KEY_URI__',
        keyPath,
      );
      res.writeHead(
        200,
        this.buildPlaybackHeaders({
          'Content-Type': 'application/vnd.apple.mpegurl',
        }),
      );
      res.end(resolvedManifest);
      return;
    }

    const r2Data = await this.r2Service.getFileStream(assetKey, range);
    const headers: any = this.buildPlaybackHeaders({
      'Content-Type': r2Data.contentType,
      'Content-Length': r2Data.contentLength,
      'Accept-Ranges': 'bytes',
    });

    if (r2Data.contentRange) {
      headers['Content-Range'] = r2Data.contentRange;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    r2Data.stream.pipe(res);
  }

  @Get(':id/lessons/:lessonId/hls-key')
  async streamLessonHlsKey(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Res() res: Response,
    @Query('playbackToken') playbackToken?: string,
  ) {
    const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
    if (fetchDest === 'document' || fetchDest === 'iframe') {
      throw new ForbiddenException(
        "Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi",
      );
    }

    const currentUserId = await this.resolvePlaybackUserId(
      req,
      id,
      lessonId,
      playbackToken,
    );
    const { lesson } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
    );

    if (!lesson.hlsKeyAsset) {
      throw new NotFoundException('HLS key topilmadi');
    }

    const keyData = await this.r2Service.getFileStream(lesson.hlsKeyAsset);

    res.writeHead(
      200,
      this.buildPlaybackHeaders({
        'Content-Type': 'application/octet-stream',
        'Content-Length': keyData.contentLength,
      }),
    );

    keyData.stream.pipe(res);
  }

  @Get(':id/lessons/:lessonId/stream')
  async streamLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Headers('range') range: string,
    @Res() res: Response,
    @Query('playbackToken') playbackToken?: string,
  ) {
    const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
    if (fetchDest === 'document' || fetchDest === 'iframe') {
      throw new ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
    }

    const currentUserId = await this.resolvePlaybackUserId(
      req,
      id,
      lessonId,
      playbackToken,
    );
    const { keyToStream } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
    );

    const r2Data = await this.r2Service.getFileStream(keyToStream, range);

    const headers: any = this.buildPlaybackHeaders({
      'Content-Type': r2Data.contentType,
      'Content-Length': r2Data.contentLength,
      'Accept-Ranges': 'bytes',
    });

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
