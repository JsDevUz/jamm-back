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
let CoursesController = class CoursesController {
    coursesService;
    r2Service;
    constructor(coursesService, r2Service) {
        this.coursesService = coursesService;
        this.r2Service = r2Service;
    }
    findAll(req, page, limit) {
        return this.coursesService.getAllCoursesForUser(req.user._id.toString(), {
            page: Number(page) || 1,
            limit: Number(limit) || 15,
        });
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
    async uploadMedia(file) {
        const fileUrl = await this.r2Service.uploadFile(file, 'courses');
        return {
            url: fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
        };
    }
    async streamLesson(req, id, lessonId, range, res) {
        const course = await this.coursesService.findById(id);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        let hasAccess = false;
        const currentUserId = req.user._id.toString();
        if (course.createdBy.toString() === currentUserId) {
            hasAccess = true;
        }
        else {
            const isApproved = course.members.some((m) => m.userId.toString() === currentUserId && m.status === 'approved');
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
        const keyToStream = lesson.fileUrl || lesson.videoUrl;
        const r2Data = await this.r2Service.getFileStream(keyToStream, range);
        const headers = {
            'Content-Type': r2Data.contentType,
            'Content-Length': r2Data.contentLength,
            'Accept-Ranges': 'bytes',
        };
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
    (0, common_1.Post)('upload-media'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "uploadMedia", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':id/lessons/:lessonId/stream'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('lessonId')),
    __param(3, (0, common_1.Headers)('range')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
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
        r2_service_1.R2Service])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map