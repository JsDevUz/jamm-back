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
import { Throttle } from '@nestjs/throttler';
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
import {
  LessonCommentDto,
  MarkAttendanceDto,
  SubmitLessonLinkedTestAttemptDto,
  ReviewLessonHomeworkDto,
  SetAttendanceStatusDto,
  SetLessonOralAssessmentDto,
  SubmitLessonHomeworkDto,
  UpsertLessonHomeworkDto,
  UpsertLessonLinkedTestDto,
  UpsertLessonMaterialDto,
} from './dto/course-interactions.dto';
import {
  CreateCourseDto,
  CreateLessonDto,
  UpdateLessonDto,
} from './dto/course.dto';
import { UploadValidationService } from '../common/uploads/upload-validation.service';
import { createSafeSingleFileMulterOptions } from '../common/uploads/multer-options';
import { APP_LIMITS } from '../common/limits/app-limits';

const execFileAsync = promisify(execFile);

@Controller('courses')
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private r2Service: R2Service,
    private jwtService: JwtService,
    private uploadValidationService: UploadValidationService,
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

  private getLessonManifestAssetKey(media: any) {
    const candidates = [
      media?.videoUrl,
      media?.fileUrl,
      ...(Array.isArray(media?.streamAssets) ? media.streamAssets : []),
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    return (
      candidates.find((item) => item.toLowerCase().endsWith('.m3u8')) ||
      candidates[0] ||
      ''
    );
  }

  private buildProtectedHlsKeyUrl(
    courseId: string,
    lessonId: string,
    playbackToken?: string,
    mediaId?: string,
  ) {
    const baseUrl = `/courses/${courseId}/lessons/${lessonId}/hls-key`;
    const params = new URLSearchParams();
    if (playbackToken) {
      params.set('playbackToken', playbackToken);
    }
    if (mediaId) {
      params.set('mediaId', mediaId);
    }
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  }

  private buildProtectedLessonHlsAssetUrl(
    courseId: string,
    lessonId: string,
    asset: string,
    playbackToken?: string,
    mediaId?: string,
  ) {
    const baseUrl = `/courses/${courseId}/lessons/${lessonId}/hls/${encodeURIComponent(asset)}`;
    const params = new URLSearchParams();
    if (playbackToken) {
      params.set('playbackToken', playbackToken);
    }
    if (mediaId) {
      params.set('mediaId', mediaId);
    }
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  }

  private buildProtectedHomeworkHlsKeyUrl(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    submissionUserId: string,
    playbackToken?: string,
  ) {
    const baseUrl = `/courses/${courseId}/lessons/${lessonId}/homework/${assignmentId}/submissions/${submissionUserId}/hls-key`;
    if (!playbackToken) return baseUrl;
    return `${baseUrl}?playbackToken=${encodeURIComponent(playbackToken)}`;
  }

  private buildProtectedHomeworkHlsAssetUrl(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    submissionUserId: string,
    asset: string,
    playbackToken?: string,
  ) {
    const baseUrl = `/courses/${courseId}/lessons/${lessonId}/homework/${assignmentId}/submissions/${submissionUserId}/hls/${encodeURIComponent(asset)}`;
    if (!playbackToken) return baseUrl;
    return `${baseUrl}?playbackToken=${encodeURIComponent(playbackToken)}`;
  }

  private rewriteHybridManifestContent(
    manifest: string,
    manifestKey: string,
    keyUrl: string,
    rewritePlaylistUrl?: (assetName: string) => string,
  ) {
    return String(manifest || '')
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#EXT-X-KEY')) {
          // Security note:
          // Segments are served by CDN, but they remain AES-128 encrypted.
          // The decryption key never goes to CDN directly; only this backend
          // endpoint returns it after auth/playback-token validation.
          return line
            .replace('__JAMM_HLS_KEY_URI__', keyUrl)
            .replace(/URI="([^"]*)"/, `URI="${keyUrl}"`);
        }

        if (trimmed.startsWith('#')) {
          return line;
        }

        if (/^https?:\/\//i.test(trimmed)) {
          return trimmed;
        }

        if (trimmed.endsWith('.m3u8') && rewritePlaylistUrl) {
          return rewritePlaylistUrl(this.getAssetFileName(trimmed));
        }

        if (trimmed.endsWith('.ts') || trimmed.endsWith('.m4s')) {
          // Hybrid-HLS:
          // CDN serves encrypted segments directly to cut VPS traffic.
          // Optional Cloudflare WAF Referer checks can help reduce casual abuse,
          // but the real protection is that segments are useless without the key,
          // and the key is only issued by the backend after access validation.
          return this.r2Service.buildSiblingDeliveryUrl(manifestKey, trimmed);
        }

        return line;
      })
      .join('\n');
  }

  private rewriteHybridManifest(
    manifest: string,
    mediaItem: any,
    courseId: string,
    lessonId: string,
    playbackToken?: string,
    mediaId?: string,
  ) {
    const keyUrl = this.buildProtectedHlsKeyUrl(
      courseId,
      lessonId,
      playbackToken,
      mediaId,
    );
    const manifestKey = this.r2Service.getObjectKey(mediaItem.videoUrl || '');
    return this.rewriteHybridManifestContent(
      manifest,
      manifestKey,
      keyUrl,
      (assetName: string) =>
        this.buildProtectedLessonHlsAssetUrl(
          courseId,
          lessonId,
          assetName,
          playbackToken,
          mediaId,
        ),
    );
  }

  private getManifestDurationSeconds(manifestContent: string) {
    return String(manifestContent || '')
      .split(/\r?\n/)
      .reduce((sum, line) => {
        const match = line.match(/^#EXTINF:([0-9.]+)/);
        if (!match) return sum;
        return sum + Number(match[1] || 0);
      }, 0);
  }

  private async getVideoStreamProfile(filePath: string) {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_entries',
        'format=duration:stream=codec_type,codec_name,pix_fmt',
        '-show_streams',
        filePath,
      ]);
      const parsed = JSON.parse(String(stdout || '{}')) as {
        format?: { duration?: string | number };
        streams?: Array<{
          codec_type?: string;
          codec_name?: string;
          pix_fmt?: string;
        }>;
      };
      const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
      const videoStream =
        streams.find((stream) => stream?.codec_type === 'video') || null;
      const audioStream =
        streams.find((stream) => stream?.codec_type === 'audio') || null;
      const duration = Number(parsed.format?.duration || 0);

      return {
        durationSeconds:
          Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
        videoCodec: String(videoStream?.codec_name || '').toLowerCase(),
        audioCodec: String(audioStream?.codec_name || '').toLowerCase(),
        videoPixelFormat: String(videoStream?.pix_fmt || '').toLowerCase(),
      };
    } catch (error) {
      console.error('Failed to read video profile with ffprobe:', error);
    }

    return {
      durationSeconds: 0,
      videoCodec: '',
      audioCodec: '',
      videoPixelFormat: '',
    };
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
      const videoProfile = await this.getVideoStreamProfile(inputPath);
      const shouldCopyVideo =
        videoProfile.videoCodec === 'h264' &&
        (!videoProfile.videoPixelFormat ||
          videoProfile.videoPixelFormat.includes('420'));
      const hasAudio = Boolean(videoProfile.audioCodec);
      const shouldCopyAudio = hasAudio && videoProfile.audioCodec === 'aac';
      await mkdir(outputDir, { recursive: true });
      await writeFile(keyPath, keyBuffer);
      await writeFile(
        keyInfoPath,
        `${keyUriPlaceholder}\n${keyPath}\n${keyIvHex}\n`,
      );

      const ffmpegArgs = [
        '-y',
        '-i',
        inputPath,
      ];

      if (shouldCopyVideo) {
        ffmpegArgs.push('-c:v', 'copy');
      } else {
        ffmpegArgs.push(
          '-c:v',
          'libx264',
          '-preset',
          'superfast',
          '-crf',
          '24',
          '-pix_fmt',
          'yuv420p',
        );
      }

      if (!hasAudio) {
        ffmpegArgs.push('-an');
      } else if (shouldCopyAudio) {
        ffmpegArgs.push('-c:a', 'copy');
      } else {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '96k', '-ac', '2');
      }

      ffmpegArgs.push(
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
      );

      await execFileAsync('ffmpeg', ffmpegArgs);

      const fileNames = (await readdir(outputDir)).sort();
      const manifestContent = await readFile(playlistPath, 'utf8');
      const durationSeconds =
        videoProfile.durationSeconds ||
        Math.round(this.getManifestDurationSeconds(manifestContent));

      const keyAsset = `${assetFolder}/${keyFileName}`;
      await this.r2Service.uploadBuffer(
        keyBuffer,
        keyAsset,
        'application/octet-stream',
      );

      const assetEntries = fileNames.map((fileName) => ({
        fileName,
        filePath: join(outputDir, fileName),
        key: `${assetFolder}/${fileName}`,
      }));
      const assetKeys = assetEntries.map((entry) => entry.key);

      for (let index = 0; index < assetEntries.length; index += 4) {
        const batch = assetEntries.slice(index, index + 4);
        await Promise.all(
          batch.map(async ({ fileName, filePath, key }) => {
            await this.r2Service.uploadBuffer(
              await readFile(filePath),
              key,
              this.getMimeType(fileName),
            );
          }),
        );
      }

      return {
        streamType: 'hls' as const,
        fileUrl: `${assetFolder}/${playlistName}`,
        manifestUrl: `${assetFolder}/${playlistName}`,
        assetKeys,
        hlsKeyAsset: keyAsset,
        fileName: file.originalname,
        fileSize: file.size,
        durationSeconds,
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

  private buildPlaybackHeaders(
    base: Record<string, any> = {},
    cacheStrategy: 'no-cache' | 'static' | 'manifest' = 'no-cache',
  ) {
    const headers: Record<string, any> = {
      ...base,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    if (cacheStrategy === 'static') {
      // Long-term cache for immutable assets like TS segments and MP4s
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (cacheStrategy === 'manifest') {
      // Short cache for manifests which might be rewritten but are mostly stable
      headers['Cache-Control'] = 'public, max-age=60';
    } else {
      // No cache for sensitive data like HLS keys or metadata
      headers['Cache-Control'] = 'private, no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }

    return headers;
  }

  private async getAuthorizedLessonForUser(
    courseId: string,
    lessonId: string,
    userId: string,
    mediaId?: string,
  ) {
    const course = await this.coursesService.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    const lesson = course.lessons.find(
      (l: any) => l._id.toString() === lessonId || l.urlSlug === lessonId,
    );
    if (!lesson) throw new NotFoundException('Lesson not found');

    const hasAccess = this.coursesService.canUserAccessLessonByIdentifier(
      course,
      userId,
      lessonId,
    );
    if (!hasAccess) {
      throw new ForbiddenException("Darsni ko'rish huquqi yo'q");
    }

    if (lesson.status === 'draft' && course.createdBy.toString() !== userId) {
      throw new ForbiddenException("Dars hali e'lon qilinmagan");
    }

    const mediaItems =
      Array.isArray(lesson.mediaItems) && lesson.mediaItems.length
        ? lesson.mediaItems
        : lesson.videoUrl || lesson.fileUrl
          ? [
              {
                _id: lesson._id,
                title: lesson.title,
                videoUrl: lesson.videoUrl,
                fileUrl: lesson.fileUrl,
                fileName: lesson.fileName,
                fileSize: lesson.fileSize,
                streamType: lesson.streamType,
                streamAssets: lesson.streamAssets,
                hlsKeyAsset: lesson.hlsKeyAsset,
              },
            ]
          : [];

    const selectedMedia =
      mediaItems.find(
        (item: any) =>
          item?._id?.toString?.() === mediaId ||
          String(item?.id || '') === mediaId ||
          String(item?.mediaId || '') === mediaId,
      ) ||
      mediaItems[0] ||
      null;

    if (!selectedMedia?.videoUrl && !selectedMedia?.fileUrl) {
      throw new NotFoundException('Fayl yoki video topilmadi');
    }

    return {
      course,
      lesson,
      media: selectedMedia,
      keyToStream: selectedMedia.fileUrl || selectedMedia.videoUrl,
    };
  }

  private async getAuthorizedHomeworkSubmissionForUser(
    courseId: string,
    lessonId: string,
    assignmentId: string,
    submissionUserId: string,
    requesterUserId: string,
  ) {
    const course = await this.coursesService.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    const lesson = course.lessons.find(
      (item: any) =>
        item._id.toString() === lessonId || item.urlSlug === lessonId,
    ) as any;
    if (!lesson) throw new NotFoundException('Lesson not found');

    const rawHomework = Array.isArray(lesson.homework)
      ? lesson.homework
      : lesson.homework
        ? [lesson.homework]
        : [];
    const assignment = rawHomework.find(
      (item: any) =>
        item?._id?.toString?.() === assignmentId ||
        String(item?.id || '') === assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Homework assignment not found');
    }

    const submission = (assignment.submissions || []).find(
      (item: any) => item?.userId?.toString?.() === submissionUserId,
    );
    if (!submission) {
      throw new NotFoundException('Homework submission not found');
    }

    const isOwner = course.createdBy.toString() === requesterUserId;
    const isSubmissionOwner = submission.userId.toString() === requesterUserId;
    if (!isOwner && !isSubmissionOwner) {
      throw new ForbiddenException("Bu uyga vazifani ko'rish huquqi yo'q");
    }

    if (!submission.fileUrl) {
      throw new NotFoundException('Homework file not found');
    }

    return {
      course,
      lesson,
      assignment,
      submission,
      keyToStream: submission.fileUrl,
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
        const isMobilePlayback = payload?.client === 'mobile-native';
        const expectedUaHash = isMobilePlayback
          ? null
          : this.buildUserAgentHash(req.headers['user-agent']);

        if (
          payload?.type !== 'course-playback' ||
          payload?.courseId !== courseId ||
          payload?.lessonId !== lessonId ||
          (!isMobilePlayback && payload?.uaHash !== expectedUaHash)
        ) {
          throw new UnauthorizedException('Invalid playback token');
        }

        return payload.sub as string;
      } catch (error) {
        throw new UnauthorizedException(
          'Playback token yaroqsiz yoki eskirgan',
        );
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

  private async resolveHomeworkPlaybackUserId(
    req: any,
    courseId: string,
    lessonId: string,
    assignmentId: string,
    submissionUserId: string,
    playbackToken?: string,
  ) {
    const cookieToken =
      playbackToken || this.readCookie(req, this.getPlaybackCookieName());

    if (cookieToken) {
      try {
        const payload = await this.jwtService.verifyAsync(cookieToken);
        const isMobilePlayback = payload?.client === 'mobile-native';
        const expectedUaHash = isMobilePlayback
          ? null
          : this.buildUserAgentHash(req.headers['user-agent']);

        if (
          payload?.type !== 'course-homework-playback' ||
          payload?.courseId !== courseId ||
          payload?.lessonId !== lessonId ||
          payload?.assignmentId !== assignmentId ||
          payload?.submissionUserId !== submissionUserId ||
          (!isMobilePlayback && payload?.uaHash !== expectedUaHash)
        ) {
          throw new UnauthorizedException('Invalid playback token');
        }

        return payload.sub as string;
      } catch (error) {
        throw new UnauthorizedException(
          'Playback token yaroqsiz yoki eskirgan',
        );
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
  @Get('search')
  searchCourses(
    @Request() req,
    @Query('q') query?: string,
    @Query('limit') limit?: number,
  ) {
    return this.coursesService.searchCoursesForUser(
      query || '',
      req.user._id.toString(),
      Number(limit) || 20,
    );
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
  create(@Request() req, @Body() body: CreateCourseDto) {
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
    @Body() body: CreateLessonDto,
  ) {
    return this.coursesService.addLesson(id, req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId')
  updateLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: UpdateLessonDto,
  ) {
    return this.coursesService.updateLesson(
      id,
      lessonId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/publish')
  publishLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.publishLesson(
      id,
      lessonId,
      req.user._id.toString(),
    );
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
  @Get(':id/lessons/:lessonId/attendance')
  getLessonAttendance(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLessonAttendance(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons/:lessonId/attendance/self')
  markOwnAttendance(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.coursesService.markOwnAttendance(id, lessonId, req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/attendance/:userId')
  setAttendanceStatus(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('userId') userId: string,
    @Body() body: SetAttendanceStatusDto,
  ) {
    return this.coursesService.setAttendanceStatus(
      id,
      lessonId,
      userId,
      req.user._id.toString(),
      body.status || 'absent',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/homework')
  getLessonHomework(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLessonHomework(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/tests')
  getLessonLinkedTests(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLessonLinkedTests(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/tests')
  upsertLessonLinkedTest(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertLessonLinkedTestDto,
  ) {
    return this.coursesService.upsertLessonLinkedTest(
      id,
      lessonId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/lessons/:lessonId/tests/:linkedTestId')
  deleteLessonLinkedTest(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('linkedTestId') linkedTestId: string,
  ) {
    return this.coursesService.deleteLessonLinkedTest(
      id,
      lessonId,
      linkedTestId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons/:lessonId/tests/:linkedTestId/submit')
  submitLessonLinkedTestAttempt(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('linkedTestId') linkedTestId: string,
    @Body() body: SubmitLessonLinkedTestAttemptDto,
  ) {
    return this.coursesService.submitLessonLinkedTestAttempt(
      id,
      lessonId,
      linkedTestId,
      req.user,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/materials')
  getLessonMaterials(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLessonMaterials(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/materials')
  upsertLessonMaterial(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertLessonMaterialDto,
  ) {
    return this.coursesService.upsertLessonMaterial(
      id,
      lessonId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/lessons/:lessonId/materials/:materialId')
  deleteLessonMaterial(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.coursesService.deleteLessonMaterial(
      id,
      lessonId,
      materialId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/homework')
  upsertLessonHomework(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertLessonHomeworkDto,
  ) {
    return this.coursesService.upsertLessonHomework(
      id,
      lessonId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/lessons/:lessonId/homework/:assignmentId')
  deleteLessonHomework(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.coursesService.deleteLessonHomework(
      id,
      lessonId,
      assignmentId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lessons/:lessonId/homework/:assignmentId/submit')
  submitLessonHomework(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: SubmitLessonHomeworkDto,
  ) {
    return this.coursesService.submitLessonHomework(
      id,
      lessonId,
      assignmentId,
      req.user,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/homework/:assignmentId/review/:userId')
  reviewLessonHomework(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('userId') userId: string,
    @Body() body: ReviewLessonHomeworkDto,
  ) {
    return this.coursesService.reviewLessonHomework(
      id,
      lessonId,
      assignmentId,
      userId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/lessons/:lessonId/oral-assessment/:userId')
  setLessonOralAssessment(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('userId') userId: string,
    @Body() body: SetLessonOralAssessmentDto,
  ) {
    return this.coursesService.setLessonOralAssessment(
      id,
      lessonId,
      userId,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/lessons/:lessonId/grading')
  getLessonGrading(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.getLessonGrading(
      id,
      lessonId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-media')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(
      'file',
      createSafeSingleFileMulterOptions(APP_LIMITS.lessonMediaBytes),
    ),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    await this.uploadValidationService.validateCourseMediaUpload(file);
    if (file?.mimetype?.startsWith('video/')) {
      return this.transcodeVideoToHls(file);
    }

    const fileUrl = await this.r2Service.uploadFile(file, 'courses');
    return {
      streamType: 'direct',
      fileUrl,
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      durationSeconds: 0,
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
    @Query('mediaId') mediaId?: string,
    @Query('client') client?: string,
  ) {
    const { media } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      req.user._id.toString(),
      mediaId,
    );

    const token = await this.jwtService.signAsync(
      {
        sub: req.user._id.toString(),
        courseId: id,
        lessonId,
        type: 'course-playback',
        client: client === 'mobile-native' ? 'mobile-native' : 'web',
        uaHash:
          client === 'mobile-native'
            ? null
            : this.buildUserAgentHash(userAgent),
      },
      { expiresIn: '2h' },
    );

    const manifestAssetKey = this.getLessonManifestAssetKey(media);
    const isHlsLesson =
      media.streamType === 'hls' ||
      String(manifestAssetKey || '').toLowerCase().endsWith('.m3u8');
    const manifestName = this.getAssetFileName(manifestAssetKey) || 'master.m3u8';
    const mediaQuery = mediaId ? `&mediaId=${encodeURIComponent(mediaId)}` : '';

    return {
      expiresIn: 60 * 60 * 2,
      playbackToken: token,
      streamType: isHlsLesson ? 'hls' : 'direct',
      streamUrl: isHlsLesson
        ? `/courses/${id}/lessons/${lessonId}/hls/${manifestName}?playbackToken=${encodeURIComponent(token)}${mediaQuery}`
        : `/courses/${id}/lessons/${lessonId}/stream?playbackToken=${encodeURIComponent(token)}${mediaQuery}`,
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
    @Query('mediaId') mediaId?: string,
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
    const { media } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
      mediaId,
    );

    const assetKey = [
      media.videoUrl,
      media.fileUrl,
      ...(media.streamAssets || []),
    ].find(
      (key: string) => this.getAssetFileName(key) === asset,
    );
    if (!assetKey) {
      throw new NotFoundException('HLS asset topilmadi');
    }

    if (asset.endsWith('.m3u8')) {
      const manifest = await this.r2Service.getFileText(assetKey);
      const resolvedManifest = this.rewriteHybridManifest(
        manifest,
        media,
        id,
        lessonId,
        playbackToken,
        mediaId,
      );
      res.writeHead(
        200,
        this.buildPlaybackHeaders(
          {
            'Content-Type': 'application/vnd.apple.mpegurl',
          },
          'manifest',
        ),
      );
      res.end(resolvedManifest);
      return;
    }

    const r2Data = await this.r2Service.getFileStream(assetKey, range);

    const cacheStrategy =
      asset.endsWith('.ts') || asset.endsWith('.m4s') ? 'static' : 'no-cache';

    const headers: any = this.buildPlaybackHeaders(
      {
        'Content-Type': r2Data.contentType,
        'Content-Length': r2Data.contentLength,
        'Accept-Ranges': 'bytes',
      },
      cacheStrategy,
    );

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
    @Query('mediaId') mediaId?: string,
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
    const { media } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
      mediaId,
    );

    if (!media.hlsKeyAsset) {
      throw new NotFoundException('HLS key topilmadi');
    }

    const keyData = await this.r2Service.getFileStream(media.hlsKeyAsset);

    res.writeHead(
      200,
      this.buildPlaybackHeaders({
        'Content-Type': 'application/octet-stream',
        'Content-Length': keyData.contentLength,
      }),
    );

    keyData.stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get(
    ':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/playback-token',
  )
  async getHomeworkSubmissionPlaybackToken(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('userId') submissionUserId: string,
    @Query('client') client?: string,
  ) {
    const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      req.user._id.toString(),
    );

    const token = await this.jwtService.signAsync(
      {
        sub: req.user._id.toString(),
        courseId: id,
        lessonId,
        assignmentId,
        submissionUserId,
        type: 'course-homework-playback',
        client: client === 'mobile-native' ? 'mobile-native' : 'web',
        uaHash:
          client === 'mobile-native'
            ? null
            : this.buildUserAgentHash(req.headers['user-agent']),
      },
      { expiresIn: '2h' },
    );

    const isHlsSubmission =
      submission.streamType === 'hls' || submission.fileUrl?.endsWith('.m3u8');
    const basePath = `/courses/${id}/lessons/${lessonId}/homework/${assignmentId}/submissions/${submissionUserId}`;

    return {
      streamType: isHlsSubmission ? 'hls' : 'direct',
      streamUrl: isHlsSubmission
        ? `${basePath}/hls/master.m3u8?playbackToken=${encodeURIComponent(token)}`
        : `${basePath}/stream?playbackToken=${encodeURIComponent(token)}`,
      playbackToken: token,
    };
  }

  @Get(
    ':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/hls/:asset',
  )
  async streamHomeworkSubmissionHlsAsset(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('userId') submissionUserId: string,
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

    const currentUserId = await this.resolveHomeworkPlaybackUserId(
      req,
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      playbackToken,
    );
    const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      currentUserId,
    );

    const assetKey =
      asset === 'master.m3u8'
        ? this.r2Service.getObjectKey(submission.fileUrl || '')
        : (submission.streamAssets || []).find(
            (item: string) => this.getAssetFileName(item) === asset,
          );

    if (!assetKey) {
      throw new NotFoundException('HLS asset topilmadi');
    }

    if (asset.endsWith('.m3u8')) {
      const manifest = await this.r2Service.getFileText(assetKey);
      const keyUrl = this.buildProtectedHomeworkHlsKeyUrl(
        id,
        lessonId,
        assignmentId,
        submissionUserId,
        playbackToken,
      );
      const resolvedManifest = this.rewriteHybridManifestContent(
        manifest,
        assetKey,
        keyUrl,
        (assetName: string) =>
          this.buildProtectedHomeworkHlsAssetUrl(
            id,
            lessonId,
            assignmentId,
            submissionUserId,
            assetName,
            playbackToken,
          ),
      );
      res.writeHead(
        200,
        this.buildPlaybackHeaders(
          {
            'Content-Type': 'application/vnd.apple.mpegurl',
          },
          'manifest',
        ),
      );
      res.end(resolvedManifest);
      return;
    }

    const r2Data = await this.r2Service.getFileStream(assetKey, range);

    const cacheStrategy =
      asset.endsWith('.ts') || asset.endsWith('.m4s') ? 'static' : 'no-cache';

    const headers: any = this.buildPlaybackHeaders(
      {
        'Content-Type': r2Data.contentType,
        'Content-Length': r2Data.contentLength,
        'Accept-Ranges': 'bytes',
      },
      cacheStrategy,
    );

    if (r2Data.contentRange) {
      headers['Content-Range'] = r2Data.contentRange;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    r2Data.stream.pipe(res);
  }

  @Get(
    ':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/hls-key',
  )
  async streamHomeworkSubmissionHlsKey(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('userId') submissionUserId: string,
    @Res() res: Response,
    @Query('playbackToken') playbackToken?: string,
  ) {
    const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
    if (fetchDest === 'document' || fetchDest === 'iframe') {
      throw new ForbiddenException(
        "Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi",
      );
    }

    const currentUserId = await this.resolveHomeworkPlaybackUserId(
      req,
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      playbackToken,
    );
    const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      currentUserId,
    );

    if (!submission.hlsKeyAsset) {
      throw new NotFoundException('HLS key topilmadi');
    }

    const keyData = await this.r2Service.getFileStream(submission.hlsKeyAsset);
    res.writeHead(
      200,
      this.buildPlaybackHeaders({
        'Content-Type': 'application/octet-stream',
        'Content-Length': keyData.contentLength,
      }),
    );
    keyData.stream.pipe(res);
  }

  @Get(
    ':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/stream',
  )
  async streamHomeworkSubmission(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('userId') submissionUserId: string,
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

    const currentUserId = await this.resolveHomeworkPlaybackUserId(
      req,
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      playbackToken,
    );
    const { keyToStream } = await this.getAuthorizedHomeworkSubmissionForUser(
      id,
      lessonId,
      assignmentId,
      submissionUserId,
      currentUserId,
    );

    const assetKey = this.r2Service.getObjectKey(keyToStream);
    const r2Data = await this.r2Service.getFileStream(assetKey, range);

    const cacheStrategy = assetKey.toLowerCase().endsWith('.mp4')
      ? 'static'
      : 'no-cache';

    const headers: any = this.buildPlaybackHeaders(
      {
        'Content-Type': r2Data.contentType,
        'Content-Length': r2Data.contentLength,
        'Accept-Ranges': 'bytes',
      },
      cacheStrategy,
    );

    if (r2Data.contentRange) {
      headers['Content-Range'] = r2Data.contentRange;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    r2Data.stream.pipe(res);
  }

  @Get(':id/lessons/:lessonId/stream')
  async streamLesson(
    @Request() req,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Headers('range') range: string,
    @Res() res: Response,
    @Query('playbackToken') playbackToken?: string,
    @Query('mediaId') mediaId?: string,
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
    const { keyToStream } = await this.getAuthorizedLessonForUser(
      id,
      lessonId,
      currentUserId,
      mediaId,
    );

    const r2Data = await this.r2Service.getFileStream(keyToStream, range);

    const cacheStrategy = keyToStream.toLowerCase().endsWith('.mp4')
      ? 'static'
      : 'no-cache';

    const headers: any = this.buildPlaybackHeaders(
      {
        'Content-Type': r2Data.contentType,
        'Content-Length': r2Data.contentLength,
        'Accept-Ranges': 'bytes',
      },
      cacheStrategy,
    );

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
    @Body() body: LessonCommentDto,
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
    @Body() body: LessonCommentDto,
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
