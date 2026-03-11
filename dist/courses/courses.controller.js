"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const courses_service_1 = require("./courses.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const platform_express_1 = require("@nestjs/platform-express");
const r2_service_1 = require("../common/services/r2.service");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const os_1 = require("os");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const child_process_1 = require("child_process");
const util_1 = require("util");
const course_interactions_dto_1 = require("./dto/course-interactions.dto");
const course_dto_1 = require("./dto/course.dto");
const upload_validation_service_1 = require("../common/uploads/upload-validation.service");
const multer_options_1 = require("../common/uploads/multer-options");
const app_limits_1 = require("../common/limits/app-limits");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let CoursesController = class CoursesController {
    coursesService;
    r2Service;
    jwtService;
    uploadValidationService;
    constructor(coursesService, r2Service, jwtService, uploadValidationService) {
        this.coursesService = coursesService;
        this.r2Service = r2Service;
        this.jwtService = jwtService;
        this.uploadValidationService = uploadValidationService;
    }
    buildUserAgentHash(userAgent) {
        return (0, crypto_1.createHash)('sha256')
            .update(userAgent || 'unknown-agent')
            .digest('hex')
            .slice(0, 24);
    }
    getMimeType(fileName) {
        const extension = (0, path_1.extname)(fileName).toLowerCase();
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
    getAssetFileName(assetKey) {
        return (0, path_1.basename)(String(assetKey || '').split('?')[0]);
    }
    buildProtectedHlsKeyUrl(courseId, lessonId, playbackToken, mediaId) {
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
    buildProtectedHomeworkHlsKeyUrl(courseId, lessonId, assignmentId, submissionUserId, playbackToken) {
        const baseUrl = `/courses/${courseId}/lessons/${lessonId}/homework/${assignmentId}/submissions/${submissionUserId}/hls-key`;
        if (!playbackToken)
            return baseUrl;
        return `${baseUrl}?playbackToken=${encodeURIComponent(playbackToken)}`;
    }
    rewriteHybridManifestContent(manifest, manifestKey, keyUrl) {
        return String(manifest || '')
            .split(/\r?\n/)
            .map((line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return line;
            if (trimmed.startsWith('#EXT-X-KEY')) {
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
            if (trimmed.endsWith('.ts') || trimmed.endsWith('.m4s')) {
                return this.r2Service.buildSiblingDeliveryUrl(manifestKey, trimmed);
            }
            return line;
        })
            .join('\n');
    }
    rewriteHybridManifest(manifest, mediaItem, courseId, lessonId, playbackToken, mediaId) {
        const keyUrl = this.buildProtectedHlsKeyUrl(courseId, lessonId, playbackToken, mediaId);
        const manifestKey = this.r2Service.getObjectKey(mediaItem.videoUrl || '');
        return this.rewriteHybridManifestContent(manifest, manifestKey, keyUrl);
    }
    getManifestDurationSeconds(manifestContent) {
        return String(manifestContent || '')
            .split(/\r?\n/)
            .reduce((sum, line) => {
            const match = line.match(/^#EXTINF:([0-9.]+)/);
            if (!match)
                return sum;
            return sum + Number(match[1] || 0);
        }, 0);
    }
    async getVideoDurationSeconds(filePath) {
        try {
            const { stdout } = await execFileAsync('ffprobe', [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                filePath,
            ]);
            const duration = Number(String(stdout || '').trim());
            if (Number.isFinite(duration) && duration > 0) {
                return Math.round(duration);
            }
        }
        catch (error) {
            console.error('Failed to read video duration with ffprobe:', error);
        }
        return 0;
    }
    async transcodeVideoToHls(file) {
        const tempRoot = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), 'jamm-hls-'));
        const inputPath = (0, path_1.join)(tempRoot, `input${(0, path_1.extname)(file.originalname || '') || '.mp4'}`);
        const outputDir = (0, path_1.join)(tempRoot, 'output');
        const playlistName = 'master.m3u8';
        const playlistPath = (0, path_1.join)(outputDir, playlistName);
        const assetFolder = `courses/hls/${(0, crypto_1.randomUUID)()}`;
        const keyFileName = 'enc.key';
        const keyUriPlaceholder = '__JAMM_HLS_KEY_URI__';
        const keyPath = (0, path_1.join)(tempRoot, keyFileName);
        const keyInfoPath = (0, path_1.join)(tempRoot, 'enc.keyinfo');
        const keyBuffer = (0, crypto_1.randomBytes)(16);
        const keyIvHex = (0, crypto_1.randomBytes)(16).toString('hex');
        try {
            await (0, promises_1.writeFile)(inputPath, file.buffer);
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
            await (0, promises_1.writeFile)(keyPath, keyBuffer);
            await (0, promises_1.writeFile)(keyInfoPath, `${keyUriPlaceholder}\n${keyPath}\n${keyIvHex}\n`);
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
                (0, path_1.join)(outputDir, 'segment_%03d.ts'),
                playlistPath,
            ]);
            const fileNames = (await (0, promises_1.readdir)(outputDir)).sort();
            const assetKeys = [];
            const manifestContent = await (0, promises_1.readFile)(playlistPath, 'utf8');
            const durationSeconds = (await this.getVideoDurationSeconds(inputPath)) ||
                Math.round(this.getManifestDurationSeconds(manifestContent));
            const keyAsset = `${assetFolder}/${keyFileName}`;
            await this.r2Service.uploadBuffer(keyBuffer, keyAsset, 'application/octet-stream');
            for (const fileName of fileNames) {
                const filePath = (0, path_1.join)(outputDir, fileName);
                const key = `${assetFolder}/${fileName}`;
                await this.r2Service.uploadBuffer(await (0, promises_1.readFile)(filePath), key, this.getMimeType(fileName));
                assetKeys.push(key);
            }
            return {
                streamType: 'hls',
                fileUrl: `${assetFolder}/${playlistName}`,
                manifestUrl: `${assetFolder}/${playlistName}`,
                assetKeys,
                hlsKeyAsset: keyAsset,
                fileName: file.originalname,
                fileSize: file.size,
                durationSeconds,
            };
        }
        finally {
            await (0, promises_1.rm)(tempRoot, { recursive: true, force: true });
        }
    }
    getPlaybackCookieName() {
        return 'jamm_course_playback';
    }
    readCookie(req, name) {
        const raw = req.headers.cookie;
        if (!raw)
            return null;
        const match = raw
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`));
        return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
    }
    buildPlaybackHeaders(base = {}, cacheStrategy = 'no-cache') {
        const headers = {
            ...base,
            'Content-Disposition': 'inline',
            'X-Content-Type-Options': 'nosniff',
            'Cross-Origin-Resource-Policy': 'same-site',
        };
        if (cacheStrategy === 'static') {
            headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }
        else if (cacheStrategy === 'manifest') {
            headers['Cache-Control'] = 'public, max-age=60';
        }
        else {
            headers['Cache-Control'] = 'private, no-store, no-cache, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
        }
        return headers;
    }
    async getAuthorizedLessonForUser(courseId, lessonId, userId, mediaId) {
        const course = await this.coursesService.findById(courseId);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        const hasAccess = this.coursesService.canUserAccessLessonByIdentifier(course, userId, lessonId);
        if (!hasAccess) {
            throw new common_1.ForbiddenException("Darsni ko'rish huquqi yo'q");
        }
        if (lesson.status === 'draft' && course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Dars hali e'lon qilinmagan");
        }
        const mediaItems = Array.isArray(lesson.mediaItems) && lesson.mediaItems.length
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
        const selectedMedia = mediaItems.find((item) => item?._id?.toString?.() === mediaId ||
            String(item?.id || '') === mediaId) ||
            mediaItems[0] ||
            null;
        if (!selectedMedia?.videoUrl && !selectedMedia?.fileUrl) {
            throw new common_1.NotFoundException('Fayl yoki video topilmadi');
        }
        return {
            course,
            lesson,
            media: selectedMedia,
            keyToStream: selectedMedia.fileUrl || selectedMedia.videoUrl,
        };
    }
    async getAuthorizedHomeworkSubmissionForUser(courseId, lessonId, assignmentId, submissionUserId, requesterUserId) {
        const course = await this.coursesService.findById(courseId);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const lesson = course.lessons.find((item) => item._id.toString() === lessonId || item.urlSlug === lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        const rawHomework = Array.isArray(lesson.homework)
            ? lesson.homework
            : lesson.homework
                ? [lesson.homework]
                : [];
        const assignment = rawHomework.find((item) => item?._id?.toString?.() === assignmentId ||
            String(item?.id || '') === assignmentId);
        if (!assignment) {
            throw new common_1.NotFoundException('Homework assignment not found');
        }
        const submission = (assignment.submissions || []).find((item) => item?.userId?.toString?.() === submissionUserId);
        if (!submission) {
            throw new common_1.NotFoundException('Homework submission not found');
        }
        const isOwner = course.createdBy.toString() === requesterUserId;
        const isSubmissionOwner = submission.userId.toString() === requesterUserId;
        if (!isOwner && !isSubmissionOwner) {
            throw new common_1.ForbiddenException("Bu uyga vazifani ko'rish huquqi yo'q");
        }
        if (!submission.fileUrl) {
            throw new common_1.NotFoundException('Homework file not found');
        }
        return {
            course,
            lesson,
            assignment,
            submission,
            keyToStream: submission.fileUrl,
        };
    }
    async resolvePlaybackUserId(req, courseId, lessonId, playbackToken) {
        const cookieToken = playbackToken || this.readCookie(req, this.getPlaybackCookieName());
        if (cookieToken) {
            try {
                const payload = await this.jwtService.verifyAsync(cookieToken);
                const expectedUaHash = this.buildUserAgentHash(req.headers['user-agent']);
                if (payload?.type !== 'course-playback' ||
                    payload?.courseId !== courseId ||
                    payload?.lessonId !== lessonId ||
                    payload?.uaHash !== expectedUaHash) {
                    throw new common_1.UnauthorizedException('Invalid playback token');
                }
                return payload.sub;
            }
            catch (error) {
                throw new common_1.UnauthorizedException('Playback token yaroqsiz yoki eskirgan');
            }
        }
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;
        if (!bearerToken) {
            throw new common_1.UnauthorizedException('Autentifikatsiya talab qilinadi');
        }
        try {
            const payload = await this.jwtService.verifyAsync(bearerToken);
            return payload.sub;
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Autentifikatsiya xato');
        }
    }
    async resolveHomeworkPlaybackUserId(req, courseId, lessonId, assignmentId, submissionUserId, playbackToken) {
        const cookieToken = playbackToken || this.readCookie(req, this.getPlaybackCookieName());
        if (cookieToken) {
            try {
                const payload = await this.jwtService.verifyAsync(cookieToken);
                const expectedUaHash = this.buildUserAgentHash(req.headers['user-agent']);
                if (payload?.type !== 'course-homework-playback' ||
                    payload?.courseId !== courseId ||
                    payload?.lessonId !== lessonId ||
                    payload?.assignmentId !== assignmentId ||
                    payload?.submissionUserId !== submissionUserId ||
                    payload?.uaHash !== expectedUaHash) {
                    throw new common_1.UnauthorizedException('Invalid playback token');
                }
                return payload.sub;
            }
            catch (error) {
                throw new common_1.UnauthorizedException('Playback token yaroqsiz yoki eskirgan');
            }
        }
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;
        if (!bearerToken) {
            throw new common_1.UnauthorizedException('Autentifikatsiya talab qilinadi');
        }
        try {
            const payload = await this.jwtService.verifyAsync(bearerToken);
            return payload.sub;
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Autentifikatsiya xato');
        }
    }
    findAll(req, page, limit) {
        return this.coursesService.getAllCoursesForUser(req.user._id.toString(), {
            page: Number(page) || 1,
            limit: Number(limit) || 15,
        });
    }
    getLikedLessons(req) {
        return this.coursesService.getLikedLessons(req.user._id.toString());
    }
    findOne(req, id) {
        return this.coursesService.getCourseForUser(id, req.user._id.toString());
    }
    create(req, body) {
        return this.coursesService.create(req.user._id.toString(), body);
    }
    delete(req, id) {
        return this.coursesService.delete(id, req.user._id.toString());
    }
    addLesson(req, id, body) {
        return this.coursesService.addLesson(id, req.user._id.toString(), body);
    }
    updateLesson(req, id, lessonId, body) {
        return this.coursesService.updateLesson(id, lessonId, req.user._id.toString(), body);
    }
    publishLesson(req, id, lessonId) {
        return this.coursesService.publishLesson(id, lessonId, req.user._id.toString());
    }
    removeLesson(req, id, lessonId) {
        return this.coursesService.removeLesson(id, lessonId, req.user._id.toString());
    }
    incrementViews(id, lessonId) {
        return this.coursesService.incrementViews(id, lessonId);
    }
    likeLesson(req, id, lessonId) {
        return this.coursesService.toggleLessonLike(id, lessonId, req.user._id.toString());
    }
    getLessonAttendance(req, id, lessonId) {
        return this.coursesService.getLessonAttendance(id, lessonId, req.user._id.toString());
    }
    markOwnAttendance(req, id, lessonId, body) {
        return this.coursesService.markOwnAttendance(id, lessonId, req.user, body);
    }
    setAttendanceStatus(req, id, lessonId, userId, body) {
        return this.coursesService.setAttendanceStatus(id, lessonId, userId, req.user._id.toString(), body.status || 'absent');
    }
    getLessonHomework(req, id, lessonId) {
        return this.coursesService.getLessonHomework(id, lessonId, req.user._id.toString());
    }
    getLessonLinkedTests(req, id, lessonId) {
        return this.coursesService.getLessonLinkedTests(id, lessonId, req.user._id.toString());
    }
    upsertLessonLinkedTest(req, id, lessonId, body) {
        return this.coursesService.upsertLessonLinkedTest(id, lessonId, req.user._id.toString(), body);
    }
    deleteLessonLinkedTest(req, id, lessonId, linkedTestId) {
        return this.coursesService.deleteLessonLinkedTest(id, lessonId, linkedTestId, req.user._id.toString());
    }
    submitLessonLinkedTestAttempt(req, id, lessonId, linkedTestId, body) {
        return this.coursesService.submitLessonLinkedTestAttempt(id, lessonId, linkedTestId, req.user, body);
    }
    getLessonMaterials(req, id, lessonId) {
        return this.coursesService.getLessonMaterials(id, lessonId, req.user._id.toString());
    }
    upsertLessonMaterial(req, id, lessonId, body) {
        return this.coursesService.upsertLessonMaterial(id, lessonId, req.user._id.toString(), body);
    }
    deleteLessonMaterial(req, id, lessonId, materialId) {
        return this.coursesService.deleteLessonMaterial(id, lessonId, materialId, req.user._id.toString());
    }
    upsertLessonHomework(req, id, lessonId, body) {
        return this.coursesService.upsertLessonHomework(id, lessonId, req.user._id.toString(), body);
    }
    deleteLessonHomework(req, id, lessonId, assignmentId) {
        return this.coursesService.deleteLessonHomework(id, lessonId, assignmentId, req.user._id.toString());
    }
    submitLessonHomework(req, id, lessonId, assignmentId, body) {
        return this.coursesService.submitLessonHomework(id, lessonId, assignmentId, req.user, body);
    }
    reviewLessonHomework(req, id, lessonId, assignmentId, userId, body) {
        return this.coursesService.reviewLessonHomework(id, lessonId, assignmentId, userId, req.user._id.toString(), body);
    }
    setLessonOralAssessment(req, id, lessonId, userId, body) {
        return this.coursesService.setLessonOralAssessment(id, lessonId, userId, req.user._id.toString(), body);
    }
    getLessonGrading(req, id, lessonId) {
        return this.coursesService.getLessonGrading(id, lessonId, req.user._id.toString());
    }
    async uploadMedia(file) {
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
    async getLessonPlaybackToken(req, id, lessonId, userAgent, res, mediaId) {
        const { media } = await this.getAuthorizedLessonForUser(id, lessonId, req.user._id.toString(), mediaId);
        const token = await this.jwtService.signAsync({
            sub: req.user._id.toString(),
            courseId: id,
            lessonId,
            type: 'course-playback',
            uaHash: this.buildUserAgentHash(userAgent),
        }, { expiresIn: '2h' });
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie(this.getPlaybackCookieName(), token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd,
            maxAge: 1000 * 60 * 60 * 2,
            path: `/courses/${id}/lessons/${lessonId}`,
        });
        const isHlsLesson = media.streamType === 'hls' || media.videoUrl?.endsWith('.m3u8');
        const manifestName = this.getAssetFileName(media.videoUrl);
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
    async streamLessonHlsAsset(req, id, lessonId, asset, range, res, playbackToken, mediaId) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { media } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId, mediaId);
        const assetKey = [media.videoUrl, ...(media.streamAssets || [])].find((key) => this.getAssetFileName(key) === asset);
        if (!assetKey) {
            throw new common_1.NotFoundException('HLS asset topilmadi');
        }
        if (asset.endsWith('.m3u8')) {
            const manifest = await this.r2Service.getFileText(assetKey);
            const resolvedManifest = this.rewriteHybridManifest(manifest, media, id, lessonId, playbackToken, mediaId);
            res.writeHead(200, this.buildPlaybackHeaders({
                'Content-Type': 'application/vnd.apple.mpegurl',
            }, 'manifest'));
            res.end(resolvedManifest);
            return;
        }
        const r2Data = await this.r2Service.getFileStream(assetKey, range);
        const cacheStrategy = asset.endsWith('.ts') || asset.endsWith('.m4s') ? 'static' : 'no-cache';
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        }, cacheStrategy);
        if (r2Data.contentRange) {
            headers['Content-Range'] = r2Data.contentRange;
            res.writeHead(206, headers);
        }
        else {
            res.writeHead(200, headers);
        }
        r2Data.stream.pipe(res);
    }
    async streamLessonHlsKey(req, id, lessonId, res, playbackToken, mediaId) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { media } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId, mediaId);
        if (!media.hlsKeyAsset) {
            throw new common_1.NotFoundException('HLS key topilmadi');
        }
        const keyData = await this.r2Service.getFileStream(media.hlsKeyAsset);
        res.writeHead(200, this.buildPlaybackHeaders({
            'Content-Type': 'application/octet-stream',
            'Content-Length': keyData.contentLength,
        }));
        keyData.stream.pipe(res);
    }
    async getHomeworkSubmissionPlaybackToken(req, id, lessonId, assignmentId, submissionUserId) {
        const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(id, lessonId, assignmentId, submissionUserId, req.user._id.toString());
        const token = await this.jwtService.signAsync({
            sub: req.user._id.toString(),
            courseId: id,
            lessonId,
            assignmentId,
            submissionUserId,
            type: 'course-homework-playback',
            uaHash: this.buildUserAgentHash(req.headers['user-agent']),
        }, { expiresIn: '2h' });
        const isHlsSubmission = submission.streamType === 'hls' || submission.fileUrl?.endsWith('.m3u8');
        const basePath = `/courses/${id}/lessons/${lessonId}/homework/${assignmentId}/submissions/${submissionUserId}`;
        return {
            streamType: isHlsSubmission ? 'hls' : 'direct',
            streamUrl: isHlsSubmission
                ? `${basePath}/hls/master.m3u8?playbackToken=${encodeURIComponent(token)}`
                : `${basePath}/stream?playbackToken=${encodeURIComponent(token)}`,
            playbackToken: token,
        };
    }
    async streamHomeworkSubmissionHlsAsset(req, id, lessonId, assignmentId, submissionUserId, asset, range, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolveHomeworkPlaybackUserId(req, id, lessonId, assignmentId, submissionUserId, playbackToken);
        const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(id, lessonId, assignmentId, submissionUserId, currentUserId);
        const assetKey = asset === 'master.m3u8'
            ? this.r2Service.getObjectKey(submission.fileUrl || '')
            : (submission.streamAssets || []).find((item) => this.getAssetFileName(item) === asset);
        if (!assetKey) {
            throw new common_1.NotFoundException('HLS asset topilmadi');
        }
        if (asset.endsWith('.m3u8')) {
            const manifest = await this.r2Service.getFileText(assetKey);
            const keyUrl = this.buildProtectedHomeworkHlsKeyUrl(id, lessonId, assignmentId, submissionUserId, playbackToken);
            const resolvedManifest = this.rewriteHybridManifestContent(manifest, assetKey, keyUrl);
            res.writeHead(200, this.buildPlaybackHeaders({
                'Content-Type': 'application/vnd.apple.mpegurl',
            }, 'manifest'));
            res.end(resolvedManifest);
            return;
        }
        const r2Data = await this.r2Service.getFileStream(assetKey, range);
        const cacheStrategy = asset.endsWith('.ts') || asset.endsWith('.m4s') ? 'static' : 'no-cache';
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        }, cacheStrategy);
        if (r2Data.contentRange) {
            headers['Content-Range'] = r2Data.contentRange;
            res.writeHead(206, headers);
        }
        else {
            res.writeHead(200, headers);
        }
        r2Data.stream.pipe(res);
    }
    async streamHomeworkSubmissionHlsKey(req, id, lessonId, assignmentId, submissionUserId, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolveHomeworkPlaybackUserId(req, id, lessonId, assignmentId, submissionUserId, playbackToken);
        const { submission } = await this.getAuthorizedHomeworkSubmissionForUser(id, lessonId, assignmentId, submissionUserId, currentUserId);
        if (!submission.hlsKeyAsset) {
            throw new common_1.NotFoundException('HLS key topilmadi');
        }
        const keyData = await this.r2Service.getFileStream(submission.hlsKeyAsset);
        res.writeHead(200, this.buildPlaybackHeaders({
            'Content-Type': 'application/octet-stream',
            'Content-Length': keyData.contentLength,
        }));
        keyData.stream.pipe(res);
    }
    async streamHomeworkSubmission(req, id, lessonId, assignmentId, submissionUserId, range, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolveHomeworkPlaybackUserId(req, id, lessonId, assignmentId, submissionUserId, playbackToken);
        const { keyToStream } = await this.getAuthorizedHomeworkSubmissionForUser(id, lessonId, assignmentId, submissionUserId, currentUserId);
        const assetKey = this.r2Service.getObjectKey(keyToStream);
        const r2Data = await this.r2Service.getFileStream(assetKey, range);
        const cacheStrategy = assetKey.toLowerCase().endsWith('.mp4')
            ? 'static'
            : 'no-cache';
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        }, cacheStrategy);
        if (r2Data.contentRange) {
            headers['Content-Range'] = r2Data.contentRange;
            res.writeHead(206, headers);
        }
        else {
            res.writeHead(200, headers);
        }
        r2Data.stream.pipe(res);
    }
    async streamLesson(req, id, lessonId, range, res, playbackToken, mediaId) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { keyToStream } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId, mediaId);
        const r2Data = await this.r2Service.getFileStream(keyToStream, range);
        const cacheStrategy = keyToStream.toLowerCase().endsWith('.mp4')
            ? 'static'
            : 'no-cache';
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        }, cacheStrategy);
        if (r2Data.contentRange) {
            headers['Content-Range'] = r2Data.contentRange;
            res.writeHead(206, headers);
        }
        else {
            res.writeHead(200, headers);
        }
        r2Data.stream.pipe(res);
    }
    enroll(req, id) {
        return this.coursesService.enroll(id, req.user);
    }
    approveUser(req, id, memberId) {
        return this.coursesService.approveUser(id, memberId, req.user._id.toString());
    }
    removeUser(req, id, memberId) {
        return this.coursesService.removeUser(id, memberId, req.user._id.toString());
    }
    getComments(req, id, lessonId, page, limit) {
        return this.coursesService.getLessonComments(id, lessonId, {
            page: Number(page) || 1,
            limit: Number(limit) || 10,
        });
    }
    addComment(req, id, lessonId, body) {
        return this.coursesService.addComment(id, lessonId, req.user, body.text);
    }
    addReply(req, id, lessonId, commentId, body) {
        return this.coursesService.addReply(id, lessonId, commentId, req.user, body.text);
    }
};
exports.CoursesController = CoursesController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findAll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('liked-lessons'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLikedLessons", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, course_dto_1.CreateCourseDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "delete", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, course_dto_1.CreateLessonDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "addLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_dto_1.UpdateLessonDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "updateLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/publish'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "publishLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/lessons/:lessonId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "removeLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/views'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "incrementViews", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/like'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "likeLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/attendance'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLessonAttendance", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/attendance/self'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_interactions_dto_1.MarkAttendanceDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "markOwnAttendance", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/attendance/:userId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('userId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, course_interactions_dto_1.SetAttendanceStatusDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "setAttendanceStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/homework'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLessonHomework", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/tests'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLessonLinkedTests", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/tests'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_interactions_dto_1.UpsertLessonLinkedTestDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "upsertLessonLinkedTest", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/lessons/:lessonId/tests/:linkedTestId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('linkedTestId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "deleteLessonLinkedTest", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/tests/:linkedTestId/submit'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('linkedTestId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, course_interactions_dto_1.SubmitLessonLinkedTestAttemptDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "submitLessonLinkedTestAttempt", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/materials'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLessonMaterials", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/materials'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_interactions_dto_1.UpsertLessonMaterialDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "upsertLessonMaterial", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/lessons/:lessonId/materials/:materialId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('materialId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "deleteLessonMaterial", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/homework'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_interactions_dto_1.UpsertLessonHomeworkDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "upsertLessonHomework", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/lessons/:lessonId/homework/:assignmentId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "deleteLessonHomework", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/homework/:assignmentId/submit'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, course_interactions_dto_1.SubmitLessonHomeworkDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "submitLessonHomework", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/homework/:assignmentId/review/:userId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Param)('userId')),
    __param(5, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, course_interactions_dto_1.ReviewLessonHomeworkDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "reviewLessonHomework", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/lessons/:lessonId/oral-assessment/:userId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('userId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, course_interactions_dto_1.SetLessonOralAssessmentDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "setLessonOralAssessment", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/grading'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getLessonGrading", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('upload-media'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.createSafeSingleFileMulterOptions)(app_limits_1.APP_LIMITS.lessonMediaBytes))),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "uploadMedia", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/playback-token'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Headers)('user-agent')),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __param(5, (0, common_1.Query)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "getLessonPlaybackToken", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/hls/:asset'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('asset')),
    __param(4, (0, common_1.Headers)('range')),
    __param(5, (0, common_1.Res)()),
    __param(6, (0, common_1.Query)('playbackToken')),
    __param(7, (0, common_1.Query)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamLessonHlsAsset", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/hls-key'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_1.Query)('playbackToken')),
    __param(5, (0, common_1.Query)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamLessonHlsKey", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/playback-token'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "getHomeworkSubmissionPlaybackToken", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/hls/:asset'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Param)('userId')),
    __param(5, (0, common_1.Param)('asset')),
    __param(6, (0, common_1.Headers)('range')),
    __param(7, (0, common_1.Res)()),
    __param(8, (0, common_1.Query)('playbackToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamHomeworkSubmissionHlsAsset", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/hls-key'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Param)('userId')),
    __param(5, (0, common_1.Res)()),
    __param(6, (0, common_1.Query)('playbackToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamHomeworkSubmissionHlsKey", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/homework/:assignmentId/submissions/:userId/stream'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('assignmentId')),
    __param(4, (0, common_1.Param)('userId')),
    __param(5, (0, common_1.Headers)('range')),
    __param(6, (0, common_1.Res)()),
    __param(7, (0, common_1.Query)('playbackToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamHomeworkSubmission", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/stream'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Headers)('range')),
    __param(4, (0, common_1.Res)()),
    __param(5, (0, common_1.Query)('playbackToken')),
    __param(6, (0, common_1.Query)('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamLesson", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/enroll'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "enroll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id/members/:memberId/approve'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('memberId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "approveUser", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/members/:memberId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('memberId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "removeUser", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/comments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "getComments", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/comments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, course_interactions_dto_1.LessonCommentDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "addComment", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/lessons/:lessonId/comments/:commentId/replies'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Param)('commentId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, course_interactions_dto_1.LessonCommentDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "addReply", null);
exports.CoursesController = CoursesController = __decorate([
    (0, common_1.Controller)('courses'),
    __metadata("design:paramtypes", [courses_service_1.CoursesService,
        r2_service_1.R2Service,
        jwt_1.JwtService,
        upload_validation_service_1.UploadValidationService])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map