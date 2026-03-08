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
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let CoursesController = class CoursesController {
    coursesService;
    r2Service;
    jwtService;
    constructor(coursesService, r2Service, jwtService) {
        this.coursesService = coursesService;
        this.r2Service = r2Service;
        this.jwtService = jwtService;
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
                manifestUrl: `${assetFolder}/${playlistName}`,
                assetKeys,
                hlsKeyAsset: keyAsset,
                fileName: file.originalname,
                fileSize: file.size,
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
    buildPlaybackHeaders(base = {}) {
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
    async getAuthorizedLessonForUser(courseId, lessonId, userId) {
        const course = await this.coursesService.findById(courseId);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        let hasAccess = false;
        if (course.createdBy.toString() === userId) {
            hasAccess = true;
        }
        else {
            const isApproved = course.members.some((m) => m.userId.toString() === userId && m.status === 'approved');
            if (isApproved)
                hasAccess = true;
        }
        if (!hasAccess) {
            const previewLessonIndex = course.lessons.findIndex((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
            if (previewLessonIndex !== 0) {
                throw new common_1.ForbiddenException("Darsni ko'rish huquqi yo'q");
            }
        }
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        if (!lesson.videoUrl && !lesson.fileUrl) {
            throw new common_1.NotFoundException('Fayl yoki video topilmadi');
        }
        return {
            course,
            lesson,
            keyToStream: lesson.fileUrl || lesson.videoUrl,
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
    removeLesson(req, id, lessonId) {
        return this.coursesService.removeLesson(id, lessonId, req.user._id.toString());
    }
    incrementViews(id, lessonId) {
        return this.coursesService.incrementViews(id, lessonId);
    }
    likeLesson(req, id, lessonId) {
        return this.coursesService.toggleLessonLike(id, lessonId, req.user._id.toString());
    }
    async uploadMedia(file) {
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
    async getLessonPlaybackToken(req, id, lessonId, userAgent, res) {
        const { lesson } = await this.getAuthorizedLessonForUser(id, lessonId, req.user._id.toString());
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
        const isHlsLesson = lesson.streamType === 'hls' || lesson.videoUrl?.endsWith('.m3u8');
        const manifestName = this.getAssetFileName(lesson.videoUrl);
        return {
            expiresIn: 60 * 60 * 2,
            streamType: isHlsLesson ? 'hls' : 'direct',
            streamUrl: isHlsLesson
                ? `/courses/${id}/lessons/${lessonId}/hls/${manifestName}`
                : `/courses/${id}/lessons/${lessonId}/stream`,
        };
    }
    async streamLessonHlsAsset(req, id, lessonId, asset, range, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { lesson } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId);
        const assetKey = [lesson.videoUrl, ...(lesson.streamAssets || [])].find((key) => this.getAssetFileName(key) === asset);
        if (!assetKey) {
            throw new common_1.NotFoundException('HLS asset topilmadi');
        }
        if (asset.endsWith('.m3u8')) {
            const manifest = await this.r2Service.getFileText(assetKey);
            const keyPath = `/courses/${id}/lessons/${lessonId}/hls-key`;
            const resolvedManifest = manifest.replaceAll('__JAMM_HLS_KEY_URI__', keyPath);
            res.writeHead(200, this.buildPlaybackHeaders({
                'Content-Type': 'application/vnd.apple.mpegurl',
            }));
            res.end(resolvedManifest);
            return;
        }
        const r2Data = await this.r2Service.getFileStream(assetKey, range);
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        });
        if (r2Data.contentRange) {
            headers['Content-Range'] = r2Data.contentRange;
            res.writeHead(206, headers);
        }
        else {
            res.writeHead(200, headers);
        }
        r2Data.stream.pipe(res);
    }
    async streamLessonHlsKey(req, id, lessonId, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { lesson } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId);
        if (!lesson.hlsKeyAsset) {
            throw new common_1.NotFoundException('HLS key topilmadi');
        }
        const keyData = await this.r2Service.getFileStream(lesson.hlsKeyAsset);
        res.writeHead(200, this.buildPlaybackHeaders({
            'Content-Type': 'application/octet-stream',
            'Content-Length': keyData.contentLength,
        }));
        keyData.stream.pipe(res);
    }
    async streamLesson(req, id, lessonId, range, res, playbackToken) {
        const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
        if (fetchDest === 'document' || fetchDest === 'iframe') {
            throw new common_1.ForbiddenException("Bu video havolasini to'g'ridan-to'g'ri ochib bo'lmaydi");
        }
        const currentUserId = await this.resolvePlaybackUserId(req, id, lessonId, playbackToken);
        const { keyToStream } = await this.getAuthorizedLessonForUser(id, lessonId, currentUserId);
        const r2Data = await this.r2Service.getFileStream(keyToStream, range);
        const headers = this.buildPlaybackHeaders({
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        });
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
    __metadata("design:paramtypes", [Object, Object]),
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
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "addLesson", null);
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
    (0, common_1.Post)('upload-media'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamLessonHlsAsset", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/hls-key'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_1.Query)('playbackToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "streamLessonHlsKey", null);
__decorate([
    (0, common_1.Get)(':id/lessons/:lessonId/stream'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Headers)('range')),
    __param(4, (0, common_1.Res)()),
    __param(5, (0, common_1.Query)('playbackToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object, String]),
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
    __metadata("design:paramtypes", [Object, String, String, Object]),
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
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "addReply", null);
exports.CoursesController = CoursesController = __decorate([
    (0, common_1.Controller)('courses'),
    __metadata("design:paramtypes", [courses_service_1.CoursesService,
        r2_service_1.R2Service,
        jwt_1.JwtService])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map