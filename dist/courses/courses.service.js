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
const user_schema_1 = require("../users/schemas/user.schema");
const r2_service_1 = require("../common/services/r2.service");
const courses_gateway_1 = require("./courses.gateway");
let CoursesService = class CoursesService {
    courseModel;
    userModel;
    encryptionService;
    r2Service;
    coursesGateway;
    constructor(courseModel, userModel, encryptionService, r2Service, coursesGateway) {
        this.courseModel = courseModel;
        this.userModel = userModel;
        this.encryptionService = encryptionService;
        this.r2Service = r2Service;
        this.coursesGateway = coursesGateway;
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
            _id: lesson._id,
            title: lesson.title,
            type: lesson.type,
            videoUrl: lesson.videoUrl,
            fileUrl: lesson.fileUrl,
            fileName: lesson.fileName,
            fileSize: lesson.fileSize,
            urlSlug: lesson.urlSlug,
            description: lesson.description,
            views: lesson.views,
            addedAt: lesson.addedAt,
            comments: (lesson.comments || []).map((comment) => {
                const decryptedComment = this.decryptText(comment);
                return {
                    _id: decryptedComment._id,
                    userId: decryptedComment.userId,
                    userName: decryptedComment.userName,
                    userAvatar: decryptedComment.userAvatar,
                    text: decryptedComment.text,
                    createdAt: decryptedComment.createdAt,
                    replies: (decryptedComment.replies || []).map((reply) => {
                        const dr = this.decryptText(reply);
                        return {
                            _id: dr._id,
                            userId: dr.userId,
                            userName: dr.userName,
                            userAvatar: dr.userAvatar,
                            text: dr.text,
                            createdAt: dr.createdAt,
                        };
                    }),
                };
            }),
        }));
        const { __v, ...safeCourse } = course;
        return safeCourse;
    }
    async getAllCoursesForUser(userId, pagination = { page: 1, limit: 15 }) {
        const skip = (pagination.page - 1) * pagination.limit;
        const [courses, total] = await Promise.all([
            this.courseModel
                .find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pagination.limit)
                .exec(),
            this.courseModel.countDocuments(),
        ]);
        return {
            data: courses.map((c) => this.sanitizeCourse(c, userId)),
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }
    async getCourseForUser(id, userId) {
        const course = await this.findById(id);
        return this.sanitizeCourse(course, userId);
    }
    async findAll() {
        return this.courseModel.find().sort({ createdAt: -1 }).exec();
    }
    async findById(id) {
        const isObjectId = mongoose_2.Types.ObjectId.isValid(id) && String(new mongoose_2.Types.ObjectId(id)) === id;
        const query = isObjectId
            ? { $or: [{ _id: id }, { urlSlug: id }] }
            : { urlSlug: id };
        const course = await this.courseModel.findOne(query).exec();
        if (!course)
            throw new common_1.NotFoundException('Kurs topilmadi');
        return course;
    }
    async create(userId, dto) {
        const user = await this.userModel.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('Foydalanuvchi topilmadi');
        const isPremium = user.premiumStatus === 'active';
        console.log(`[DEBUG] Course creation user ${userId} premiumStatus: ${user.premiumStatus} -> isPremium=${isPremium}`);
        const limit = isPremium ? 3 : 1;
        const existingCoursesCount = await this.courseModel.countDocuments({
            createdBy: new mongoose_2.Types.ObjectId(userId),
        });
        if (existingCoursesCount >= limit) {
            throw new common_1.ForbiddenException(isPremium
                ? 'Premium obunachilar maksimal 3 ta kurs yarata oladi.'
                : 'Bepul tarifda faqat 1 ta kurs yaratish mumkin. Koproq kurs yaratish uchun Premium xarid qiling.');
        }
        let rawSlug = dto.urlSlug ||
            dto.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        let finalSlug = rawSlug;
        let counter = 1;
        while (await this.courseModel.findOne({ urlSlug: finalSlug })) {
            finalSlug = `${rawSlug}-${counter}`;
            counter++;
        }
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
            urlSlug: finalSlug,
            gradient,
            createdBy: new mongoose_2.Types.ObjectId(userId),
        });
    }
    async delete(courseId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Siz bu kursni o'chira olmaysiz");
        }
        for (const lesson of course.lessons) {
            if (lesson.fileUrl) {
                await this.r2Service.deleteFile(lesson.fileUrl);
            }
            if (lesson.videoUrl &&
                lesson.type === 'file' &&
                lesson.videoUrl.startsWith('http')) {
                await this.r2Service.deleteFile(lesson.videoUrl);
            }
        }
        await this.courseModel.findByIdAndDelete(course._id).exec();
    }
    async addLesson(courseId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars qo'sha oladi");
        }
        const user = await this.userModel.findById(userId);
        const isPremium = user?.premiumStatus === 'active';
        console.log(`[DEBUG] Lesson addition user ${userId} premiumStatus: ${user?.premiumStatus} -> isPremium=${isPremium}`);
        const limit = isPremium ? 30 : 5;
        if (course.lessons.length >= limit) {
            throw new common_1.ForbiddenException(isPremium
                ? 'Premium obunachilar har bir kursda maksimal 30 ta dars yarata oladi.'
                : "Bepul tarifda bitta kursga faqat 5 ta dars qo'shish mumkin.");
        }
        if (!isPremium && dto.type === 'file') {
            throw new common_1.ForbiddenException('Fayl yuklash uchun Premium obuna talab qilinadi');
        }
        let rawSlug = dto.urlSlug ||
            dto.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        let finalSlug = rawSlug;
        let counter = 1;
        while (course.lessons.some((l) => l.urlSlug === finalSlug)) {
            finalSlug = `${rawSlug}-${counter}`;
            counter++;
        }
        course.lessons.push({
            title: dto.title,
            type: dto.type || 'video',
            videoUrl: dto.videoUrl || '',
            fileUrl: dto.fileUrl || '',
            fileName: dto.fileName || '',
            fileSize: dto.fileSize || 0,
            urlSlug: finalSlug,
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
        const lessonObj = course.lessons.find((l) => l._id.toString() === lessonId);
        if (lessonObj) {
            if (lessonObj.fileUrl) {
                await this.r2Service
                    .deleteFile(lessonObj.fileUrl)
                    .catch((e) => console.error(`Failed to delete fileUrl ${lessonObj.fileUrl}:`, e));
            }
            if (lessonObj.videoUrl && lessonObj.type === 'file') {
                await this.r2Service
                    .deleteFile(lessonObj.videoUrl)
                    .catch((e) => console.error(`Failed to delete videoUrl ${lessonObj.videoUrl}:`, e));
            }
        }
        course.lessons = course.lessons.filter((l) => l._id.toString() !== lessonId);
        return course.save();
    }
    async incrementViews(courseId, lessonId) {
        const course = await this.findById(courseId);
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
        if (!lesson)
            return;
        await this.courseModel
            .updateOne({ _id: course._id, 'lessons._id': lesson._id }, { $inc: { 'lessons.$.views': 1 } })
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
        const updatedCourse = await course.save();
        this.coursesGateway.notifyCourse(courseId, 'course_enrolled', {
            courseId,
            user: { _id: user._id, name: user.nickname || user.username },
        });
        return updatedCourse;
    }
    async approveUser(courseId, memberId, adminId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException('Faqat kurs egasi tasdiqlashi mumkin');
        }
        const member = course.members.find((m) => m.userId.toString() === memberId);
        if (member) {
            member.status = 'approved';
        }
        const updatedCourse = await course.save();
        this.coursesGateway.notifyUser(memberId, 'member_approved', {
            courseId,
            courseName: course.name,
        });
        this.coursesGateway.notifyCourse(courseId, 'member_approved_broadcast', {
            courseId,
            memberId,
        });
        return updatedCourse;
    }
    async removeUser(courseId, memberId, adminId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId && memberId !== adminId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi o'chira oladi yoki foydalanuvchi o'zini o'zi o'chira oladi");
        }
        course.members = course.members.filter((m) => m.userId.toString() !== memberId);
        const updatedCourse = await course.save();
        this.coursesGateway.notifyUser(memberId, 'member_rejected', {
            courseId,
            courseName: course.name,
        });
        this.coursesGateway.notifyCourse(courseId, 'member_rejected_broadcast', {
            courseId,
            memberId,
        });
        return updatedCourse;
    }
    async getLessonComments(courseId, lessonId, pagination = { page: 1, limit: 10 }) {
        const course = await this.findById(courseId);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const lessonIndex = course.lessons.findIndex((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
        if (lessonIndex === -1)
            throw new common_1.NotFoundException('Lesson not found');
        const lesson = course.lessons[lessonIndex];
        const skip = (pagination.page - 1) * pagination.limit;
        const decryptedComments = (lesson.comments || []).map((comment) => {
            const decryptedComment = this.decryptText(comment);
            return {
                _id: decryptedComment._id,
                userId: decryptedComment.userId,
                userName: decryptedComment.userName,
                userAvatar: decryptedComment.userAvatar,
                text: decryptedComment.text,
                createdAt: decryptedComment.createdAt,
                replies: (decryptedComment.replies || []).map((reply) => {
                    const dr = this.decryptText(reply);
                    return {
                        _id: dr._id,
                        userId: dr.userId,
                        userName: dr.userName,
                        userAvatar: dr.userAvatar,
                        text: dr.text,
                        createdAt: dr.createdAt,
                    };
                }),
            };
        });
        decryptedComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paginatedComments = decryptedComments.slice(skip, skip + pagination.limit);
        return {
            data: paginatedComments,
            total: decryptedComments.length,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(decryptedComments.length / pagination.limit),
        };
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
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        encryption_service_1.EncryptionService,
        r2_service_1.R2Service,
        courses_gateway_1.CoursesGateway])
], CoursesService);
//# sourceMappingURL=courses.service.js.map