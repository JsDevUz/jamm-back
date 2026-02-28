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
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const course_schema_1 = require("./schemas/course.schema");
const encryption_service_1 = require("../common/encryption/encryption.service");
let CoursesService = class CoursesService {
    courseModel;
    encryptionService;
    constructor(courseModel, encryptionService) {
        this.courseModel = courseModel;
        this.encryptionService = encryptionService;
    }
    decryptText(item) {
        if (!item.isEncrypted)
            return item;
        try {
            const decrypted = this.encryptionService.decrypt({
                encryptedContent: item.text,
                iv: item.iv,
                authTag: item.authTag,
                keyVersion: item.keyVersion || 0,
            });
            return { ...item, text: decrypted };
        }
        catch (error) {
            console.error('Failed to decrypt course content:', error);
            return { ...item, text: '[Decryption Error]' };
        }
    }
    sanitizeCourse(courseDoc, userId) {
        const course = courseDoc.toObject();
        const isAdmin = course.createdBy.toString() === userId;
        const isApprovedMember = course.members.some((m) => m.userId.toString() === userId && m.status === 'approved');
        if (!isAdmin && !isApprovedMember) {
            course.lessons = course.lessons.map((lesson, index) => {
                if (index === 0)
                    return lesson;
                return {
                    ...lesson,
                    videoUrl: '',
                    description: "Darsni ko'rish uchun kursga a'zo bo'ling va admin tasdiqlashini kuting.",
                };
            });
        }
        course.lessons = course.lessons.map((lesson) => ({
            ...lesson,
            comments: (lesson.comments || []).map((comment) => {
                const decryptedComment = this.decryptText(comment);
                return {
                    ...decryptedComment,
                    replies: (decryptedComment.replies || []).map((reply) => this.decryptText(reply)),
                };
            }),
        }));
        return course;
    }
    async getAllCoursesForUser(userId) {
        const courses = await this.courseModel
            .find()
            .sort({ createdAt: -1 })
            .exec();
        return courses.map((c) => this.sanitizeCourse(c, userId));
    }
    async getCourseForUser(id, userId) {
        const course = await this.findById(id);
        return this.sanitizeCourse(course, userId);
    }
    async findAll() {
        return this.courseModel.find().sort({ createdAt: -1 }).exec();
    }
    async findById(id) {
        const course = await this.courseModel.findById(id).exec();
        if (!course)
            throw new common_1.NotFoundException('Kurs topilmadi');
        return course;
    }
    async create(userId, dto) {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)',
        ];
        const gradient = gradients[Math.floor(Math.random() * gradients.length)];
        return this.courseModel.create({
            ...dto,
            gradient,
            createdBy: new mongoose_2.Types.ObjectId(userId),
        });
    }
    async delete(courseId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Siz bu kursni o'chira olmaysiz");
        }
        await this.courseModel.findByIdAndDelete(courseId).exec();
    }
    async addLesson(courseId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars qo'sha oladi");
        }
        course.lessons.push({
            title: dto.title,
            videoUrl: dto.videoUrl,
            description: dto.description || '',
            views: 0,
            addedAt: new Date(),
            comments: [],
        });
        return course.save();
    }
    async removeLesson(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars o'chira oladi");
        }
        course.lessons = course.lessons.filter((l) => l._id.toString() !== lessonId);
        return course.save();
    }
    async incrementViews(courseId, lessonId) {
        await this.courseModel
            .updateOne({ _id: courseId, 'lessons._id': lessonId }, { $inc: { 'lessons.$.views': 1 } })
            .exec();
    }
    async enroll(courseId, user) {
        const course = await this.findById(courseId);
        const alreadyMember = course.members.find((m) => m.userId.toString() === user._id);
        if (alreadyMember)
            return course;
        course.members.push({
            userId: new mongoose_2.Types.ObjectId(user._id),
            name: user.nickname || user.username,
            avatar: (user.nickname || user.username).substring(0, 2).toUpperCase(),
            status: 'pending',
            joinedAt: new Date(),
        });
        return course.save();
    }
    async approveUser(courseId, memberId, adminId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException('Faqat kurs egasi tasdiqlashi mumkin');
        }
        const member = course.members.find((m) => m.userId.toString() === memberId);
        if (member)
            member.status = 'approved';
        return course.save();
    }
    async removeUser(courseId, memberId, adminId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi o'chira oladi");
        }
        course.members = course.members.filter((m) => m.userId.toString() !== memberId);
        return course.save();
    }
    async addComment(courseId, lessonId, user, text) {
        const course = await this.findById(courseId);
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const encrypted = this.encryptionService.encrypt(text);
        lesson.comments.push({
            userId: new mongoose_2.Types.ObjectId(user._id),
            userName: user.nickname || user.username,
            userAvatar: (user.nickname || user.username)
                .substring(0, 2)
                .toUpperCase(),
            text: encrypted.encryptedContent,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            encryptionType: 'server',
            isEncrypted: true,
            keyVersion: encrypted.keyVersion,
            searchableText: this.encryptionService.getSearchableText(text),
            createdAt: new Date(),
            replies: [],
        });
        const updatedCourse = await course.save();
        return this.sanitizeCourse(updatedCourse, user._id.toString());
    }
    async addReply(courseId, lessonId, commentId, user, text) {
        const course = await this.findById(courseId);
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const comment = lesson.comments.find((c) => c._id.toString() === commentId);
        if (!comment)
            throw new common_1.NotFoundException('Izoh topilmadi');
        const encrypted = this.encryptionService.encrypt(text);
        comment.replies.push({
            userId: new mongoose_2.Types.ObjectId(user._id),
            userName: user.nickname || user.username,
            userAvatar: (user.nickname || user.username)
                .substring(0, 2)
                .toUpperCase(),
            text: encrypted.encryptedContent,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            encryptionType: 'server',
            isEncrypted: true,
            keyVersion: encrypted.keyVersion,
            searchableText: this.encryptionService.getSearchableText(text),
            createdAt: new Date(),
        });
        const updatedCourse = await course.save();
        return this.sanitizeCourse(updatedCourse, user._id.toString());
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(course_schema_1.Course.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        encryption_service_1.EncryptionService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map