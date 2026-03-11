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
const course_member_schema_1 = require("./schemas/course-member.schema");
const course_lesson_schema_1 = require("./schemas/course-lesson.schema");
const lesson_homework_schema_1 = require("./schemas/lesson-homework.schema");
const encryption_service_1 = require("../common/encryption/encryption.service");
const user_schema_1 = require("../users/schemas/user.schema");
const r2_service_1 = require("../common/services/r2.service");
const courses_gateway_1 = require("./courses.gateway");
const arena_service_1 = require("../arena/arena.service");
const app_limits_1 = require("../common/limits/app-limits");
const generate_short_slug_1 = require("../common/utils/generate-short-slug");
let CoursesService = class CoursesService {
    courseModel;
    courseMemberRecordModel;
    courseLessonRecordModel;
    lessonHomeworkRecordModel;
    userModel;
    encryptionService;
    r2Service;
    coursesGateway;
    arenaService;
    constructor(courseModel, courseMemberRecordModel, courseLessonRecordModel, lessonHomeworkRecordModel, userModel, encryptionService, r2Service, coursesGateway, arenaService) {
        this.courseModel = courseModel;
        this.courseMemberRecordModel = courseMemberRecordModel;
        this.courseLessonRecordModel = courseLessonRecordModel;
        this.lessonHomeworkRecordModel = lessonHomeworkRecordModel;
        this.userModel = userModel;
        this.encryptionService = encryptionService;
        this.r2Service = r2Service;
        this.coursesGateway = coursesGateway;
        this.arenaService = arenaService;
    }
    async onModuleInit() {
        const courses = await this.courseModel
            .find()
            .select('_id urlSlug')
            .lean()
            .exec();
        for (const course of courses) {
            const courseId = course._id?.toString?.() || '';
            if (!courseId)
                continue;
            if (!this.isShortSlug(course.urlSlug)) {
                await this.courseModel
                    .updateOne({ _id: course._id }, { $set: { urlSlug: await this.generateUniqueCourseSlug() } })
                    .exec();
            }
            const lessonRows = await this.courseLessonRecordModel
                .find({ courseId: course._id })
                .sort({ order: 1, createdAt: 1 })
                .lean()
                .exec();
            const usedLessonSlugs = new Set();
            for (const lesson of lessonRows) {
                const currentSlug = String(lesson?.urlSlug || '').trim();
                if (!this.isShortSlug(currentSlug) ||
                    usedLessonSlugs.has(currentSlug)) {
                    const nextSlug = this.generateUniqueLessonSlug({ lessons: Array.from(usedLessonSlugs).map((urlSlug) => ({ urlSlug })) }, undefined);
                    await this.courseLessonRecordModel
                        .updateOne({ _id: lesson._id }, { $set: { urlSlug: nextSlug } })
                        .exec();
                    usedLessonSlugs.add(nextSlug);
                    continue;
                }
                usedLessonSlugs.add(currentSlug);
            }
        }
    }
    isShortSlug(value) {
        return /^[a-z0-9]{8}$/.test(String(value || '').trim());
    }
    async generateUniqueCourseSlug(preferredSlug) {
        const baseSlug = (0, generate_short_slug_1.sanitizeCustomSlug)(preferredSlug);
        if (baseSlug) {
            const existingCourse = await this.courseModel.exists({ urlSlug: baseSlug });
            if (!existingCourse)
                return baseSlug;
        }
        let slug = (0, generate_short_slug_1.generateShortSlug)(8);
        while (await this.courseModel.exists({ urlSlug: slug })) {
            slug = (0, generate_short_slug_1.generateShortSlug)(8);
        }
        return slug;
    }
    generateUniqueLessonSlug(course, preferredSlug) {
        const baseSlug = (0, generate_short_slug_1.sanitizeCustomSlug)(preferredSlug);
        const lessonSlugs = new Set((Array.isArray(course?.lessons) ? course.lessons : [])
            .map((lesson) => String(lesson?.urlSlug || '').trim())
            .filter(Boolean));
        if (baseSlug && !lessonSlugs.has(baseSlug)) {
            return baseSlug;
        }
        let slug = (0, generate_short_slug_1.generateShortSlug)(8);
        while (lessonSlugs.has(slug)) {
            slug = (0, generate_short_slug_1.generateShortSlug)(8);
        }
        return slug;
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
    async getUserPremiumStatus(userId) {
        const user = await this.userModel
            .findById(userId)
            .select('premiumStatus')
            .lean();
        return user?.premiumStatus || null;
    }
    async syncCourseMirrorCollections(course) {
        return this.persistCourseCollections(course);
    }
    attachCourseRuntimeHelpers(course) {
        if (!course || typeof course !== 'object') {
            return course;
        }
        if (!Array.isArray(course.members)) {
            course.members = [];
        }
        if (!Array.isArray(course.lessons)) {
            course.lessons = [];
        }
        if (typeof course.save !== 'function') {
            Object.defineProperty(course, 'save', {
                enumerable: false,
                configurable: true,
                writable: true,
                value: async () => course,
            });
        }
        if (typeof course.toObject !== 'function') {
            Object.defineProperty(course, 'toObject', {
                enumerable: false,
                configurable: true,
                writable: true,
                value: () => course,
            });
        }
        return course;
    }
    pickPersistedCourseFields(course) {
        return {
            name: String(course?.name || '').trim(),
            description: String(course?.description || '').trim(),
            image: String(course?.image || '').trim(),
            gradient: String(course?.gradient || '').trim(),
            category: String(course?.category || 'IT').trim() || 'IT',
            urlSlug: String(course?.urlSlug || '').trim(),
            accessType: course?.accessType || 'free_request',
            price: Number(course?.price || 0),
            rating: Number(course?.rating || 0),
            createdBy: course?.createdBy,
        };
    }
    getNormalizedMemberRows(course, courseId) {
        const ownerId = course?.createdBy?.toString?.() || '';
        return (Array.isArray(course?.members) ? course.members : [])
            .filter((member) => {
            const memberId = member?.userId?.toString?.() || '';
            return memberId && memberId !== ownerId;
        })
            .map((member) => ({
            courseId,
            userId: member.userId,
            userName: member.userName || member.name || '',
            userAvatar: member.userAvatar || member.avatar || '',
            status: member.status || 'pending',
            requestedAt: member.requestedAt || null,
            joinedAt: member.joinedAt || null,
            isAdmin: Boolean(member.isAdmin),
            permissions: Array.isArray(member.permissions) ? member.permissions : [],
        }));
    }
    getNormalizedLessonRows(course, courseId) {
        return (Array.isArray(course?.lessons) ? course.lessons : []).map((lesson, index) => ({
            courseId,
            lessonId: lesson._id || new mongoose_2.Types.ObjectId(),
            title: lesson.title || '',
            type: lesson.type || 'video',
            description: lesson.description || '',
            urlSlug: lesson.urlSlug || this.generateUniqueLessonSlug(course, lesson.urlSlug),
            status: lesson.status || 'published',
            publishedAt: lesson.publishedAt || null,
            order: index,
            videoUrl: lesson.videoUrl || '',
            fileUrl: lesson.fileUrl || '',
            fileName: lesson.fileName || '',
            fileSize: Number(lesson.fileSize || 0),
            durationSeconds: Number(lesson.durationSeconds || 0),
            streamType: lesson.streamType || 'direct',
            streamAssets: Array.isArray(lesson.streamAssets) ? lesson.streamAssets : [],
            hlsKeyAsset: lesson.hlsKeyAsset || '',
            addedAt: lesson.addedAt || null,
            views: Number(lesson.views || 0),
            likes: Array.isArray(lesson.likes) ? lesson.likes : [],
            comments: Array.isArray(lesson.comments) ? lesson.comments : [],
            attendance: Array.isArray(lesson.attendance) ? lesson.attendance : [],
            oralAssessments: Array.isArray(lesson.oralAssessments)
                ? lesson.oralAssessments
                : [],
            content: lesson.content || {},
            mediaItems: Array.isArray(lesson.mediaItems) ? lesson.mediaItems : [],
            materials: Array.isArray(lesson.materials) ? lesson.materials : [],
            linkedTests: Array.isArray(lesson.linkedTests) ? lesson.linkedTests : [],
        }));
    }
    getNormalizedHomeworkRows(course, courseId) {
        return (Array.isArray(course?.lessons) ? course.lessons : []).flatMap((lesson) => (Array.isArray(lesson?.homework) ? lesson.homework : []).map((assignment) => ({
            courseId,
            lessonId: lesson._id,
            assignmentId: assignment._id || new mongoose_2.Types.ObjectId(),
            enabled: Boolean(assignment.enabled),
            title: assignment.title || '',
            description: assignment.description || '',
            type: assignment.type || 'text',
            deadline: assignment.deadline || null,
            maxScore: assignment.maxScore || 100,
            submissions: Array.isArray(assignment.submissions)
                ? assignment.submissions
                : [],
        })));
    }
    async persistCourseCollections(course) {
        const courseId = new mongoose_2.Types.ObjectId(course._id);
        const lessonRows = this.getNormalizedLessonRows(course, courseId);
        const memberRows = this.getNormalizedMemberRows(course, courseId);
        const homeworkRows = this.getNormalizedHomeworkRows(course, courseId);
        await this.courseModel
            .updateOne({ _id: courseId }, { $set: this.pickPersistedCourseFields(course) })
            .exec();
        await Promise.all([
            this.courseMemberRecordModel.deleteMany({ courseId }),
            this.courseLessonRecordModel.deleteMany({ courseId }),
            this.lessonHomeworkRecordModel.deleteMany({ courseId }),
        ]);
        if (memberRows.length) {
            await this.courseMemberRecordModel.insertMany(memberRows);
        }
        if (lessonRows.length) {
            await this.courseLessonRecordModel.insertMany(lessonRows);
        }
        if (homeworkRows.length) {
            await this.lessonHomeworkRecordModel.insertMany(homeworkRows);
        }
    }
    async hydrateCourseCollections(course) {
        if (!course?._id) {
            return course;
        }
        const courseId = new mongoose_2.Types.ObjectId(course._id);
        const [memberRows, lessonRows, homeworkRows] = await Promise.all([
            this.courseMemberRecordModel
                .find({ courseId })
                .sort({ createdAt: 1, joinedAt: 1, requestedAt: 1 })
                .lean()
                .exec(),
            this.courseLessonRecordModel
                .find({ courseId })
                .sort({ order: 1, createdAt: 1 })
                .lean()
                .exec(),
            this.lessonHomeworkRecordModel
                .find({ courseId })
                .sort({ createdAt: 1, deadline: 1 })
                .lean()
                .exec(),
        ]);
        const homeworkByLessonId = new Map();
        for (const row of homeworkRows) {
            const lessonKey = row.lessonId?.toString?.() || '';
            if (!lessonKey)
                continue;
            const normalizedRow = {
                _id: row.assignmentId,
                enabled: Boolean(row.enabled),
                title: row.title || '',
                description: row.description || '',
                type: row.type || 'text',
                deadline: row.deadline || null,
                maxScore: Number(row.maxScore || 100),
                submissions: Array.isArray(row.submissions) ? row.submissions : [],
            };
            const bucket = homeworkByLessonId.get(lessonKey) || [];
            bucket.push(normalizedRow);
            homeworkByLessonId.set(lessonKey, bucket);
        }
        course.members = memberRows.map((row) => ({
            userId: row.userId,
            name: row.userName || '',
            avatar: row.userAvatar || '',
            status: row.status || 'pending',
            requestedAt: row.requestedAt || null,
            joinedAt: row.joinedAt || null,
            isAdmin: Boolean(row.isAdmin),
            permissions: Array.isArray(row.permissions) ? row.permissions : [],
        }));
        course.lessons = lessonRows.map((row) => {
            const lessonKey = row.lessonId?.toString?.() || '';
            return {
                _id: row.lessonId,
                title: row.title || '',
                type: row.type || 'video',
                description: row.description || '',
                urlSlug: row.urlSlug || '',
                status: row.status || 'published',
                publishedAt: row.publishedAt || null,
                videoUrl: row.videoUrl || '',
                fileUrl: row.fileUrl || '',
                fileName: row.fileName || '',
                fileSize: Number(row.fileSize || 0),
                durationSeconds: Number(row.durationSeconds || 0),
                streamType: row.streamType || 'direct',
                streamAssets: Array.isArray(row.streamAssets) ? row.streamAssets : [],
                hlsKeyAsset: row.hlsKeyAsset || '',
                addedAt: row.addedAt || null,
                views: Number(row.views || 0),
                likes: Array.isArray(row.likes) ? row.likes : [],
                comments: Array.isArray(row.comments) ? row.comments : [],
                attendance: Array.isArray(row.attendance) ? row.attendance : [],
                oralAssessments: Array.isArray(row.oralAssessments)
                    ? row.oralAssessments
                    : [],
                content: row.content || {},
                mediaItems: Array.isArray(row.mediaItems) ? row.mediaItems : [],
                materials: Array.isArray(row.materials) ? row.materials : [],
                linkedTests: Array.isArray(row.linkedTests) ? row.linkedTests : [],
                homework: homeworkByLessonId.get(lessonKey) || [],
            };
        });
        return this.attachCourseRuntimeHelpers(course);
    }
    getHomeworkFileSizeLimit(type) {
        switch (type) {
            case 'photo':
                return app_limits_1.APP_LIMITS.homeworkPhotoBytes;
            case 'audio':
                return app_limits_1.APP_LIMITS.homeworkAudioBytes;
            case 'video':
                return app_limits_1.APP_LIMITS.homeworkVideoBytes;
            case 'pdf':
                return app_limits_1.APP_LIMITS.homeworkPdfBytes;
            default:
                return 0;
        }
    }
    assertHomeworkSubmissionFileIsAllowed(type, fileName, fileSize) {
        const normalizedName = String(fileName || '').trim().toLowerCase();
        const normalizedType = String(type || 'text');
        const allowedExtensions = normalizedType === 'photo'
            ? ['.jpg', '.jpeg', '.png', '.webp', '.gif']
            : normalizedType === 'audio'
                ? ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
                : normalizedType === 'video'
                    ? ['.mp4', '.mov', '.webm', '.mkv', '.m4v']
                    : normalizedType === 'pdf'
                        ? ['.pdf']
                        : [];
        if (allowedExtensions.length &&
            normalizedName &&
            !allowedExtensions.some((extension) => normalizedName.endsWith(extension))) {
            throw new common_1.BadRequestException(`${normalizedType} uyga vazifasi uchun fayl turi noto'g'ri`);
        }
        const maxBytes = this.getHomeworkFileSizeLimit(normalizedType);
        if (maxBytes && Number(fileSize || 0) > maxBytes) {
            const maxMb = Math.round(maxBytes / (1024 * 1024));
            throw new common_1.BadRequestException(`${normalizedType} uyga vazifasi maksimal ${maxMb}MB bo'lishi kerak`);
        }
    }
    sanitizeCourse(courseDoc, userId) {
        const sourceCourse = typeof courseDoc?.toObject === 'function'
            ? courseDoc.toObject()
            : { ...courseDoc };
        const course = sourceCourse;
        const ownerId = course.createdBy.toString();
        const memberItems = (course.members || []).filter((m) => m.userId?.toString() !== ownerId);
        const isAdmin = ownerId === userId;
        const isApprovedMember = memberItems.some((m) => m.userId.toString() === userId && m.status === 'approved');
        const approvedMembers = memberItems.filter((member) => member?.status === 'approved');
        const pendingMembers = memberItems.filter((member) => member?.status === 'pending');
        if (!isAdmin) {
            course.lessons = (course.lessons || []).filter((lesson) => lesson.status !== 'draft');
        }
        if (!isAdmin && !isApprovedMember) {
            course.lessons = course.lessons.map((lesson, index) => {
                if (index === 0)
                    return lesson;
                return {
                    ...lesson,
                    videoUrl: '',
                    fileUrl: '',
                    streamAssets: [],
                    hlsKeyAsset: '',
                    description: "Darsni ko'rish uchun kursga a'zo bo'ling va admin tasdiqlashini kuting.",
                };
            });
        }
        course.members = memberItems.map((member) => ({
            userId: member.userId,
            name: member.name || '',
            avatar: member.avatar || '',
            status: member.status || 'pending',
            joinedAt: member.joinedAt || null,
        }));
        course.membersCount = approvedMembers.length;
        course.pendingMembersCount = pendingMembers.length;
        course.totalMembersCount = memberItems.length;
        course.lessonCount = (course.lessons || []).length;
        course.publishedLessonsCount = (course.lessons || []).filter((lesson) => (lesson.status || 'published') !== 'draft').length;
        course.draftLessonsCount = (course.lessons || []).filter((lesson) => (lesson.status || 'published') === 'draft').length;
        course.lessons = course.lessons.map((lesson, index) => {
            const commentsCount = Array.isArray(lesson.comments)
                ? lesson.comments.length
                : 0;
            return {
                _id: lesson._id,
                title: lesson.title,
                type: lesson.type,
                videoUrl: lesson.videoUrl,
                fileUrl: lesson.fileUrl,
                fileName: lesson.fileName,
                fileSize: lesson.fileSize,
                durationSeconds: lesson.durationSeconds || 0,
                mediaItems: this.normalizeLessonMediaItems(lesson).map((item) => this.getLessonMediaPayload(item)),
                streamType: lesson.streamType || 'direct',
                streamAssets: lesson.streamAssets || [],
                hlsKeyAsset: '',
                urlSlug: lesson.urlSlug,
                description: lesson.description,
                status: lesson.status || 'published',
                publishedAt: lesson.publishedAt || null,
                views: lesson.views,
                likes: lesson.likes?.length || 0,
                liked: Array.isArray(lesson.likes)
                    ? lesson.likes.some((id) => id.toString() === userId)
                    : false,
                addedAt: lesson.addedAt,
                commentsCount,
                accessLockedByTests: !isAdmin && isApprovedMember
                    ? this.getIncompleteRequiredTestsBeforeLesson(sourceCourse, userId, index)
                    : [],
                isUnlocked: this.canAccessLesson(sourceCourse, userId, index),
                linkedTests: this.normalizeLessonLinkedTests(lesson).map((linkedTest) => this.serializeLinkedTest(linkedTest, userId, isAdmin)),
                materials: this.normalizeLessonMaterials(lesson).map((item) => ({
                    materialId: item?._id?.toString?.() || '',
                    title: item?.title || '',
                    fileUrl: item?.fileUrl || '',
                    fileName: item?.fileName || '',
                    fileSize: item?.fileSize || 0,
                })),
                homework: {
                    assignments: this.ensureHomeworkAssignments(lesson).map((assignment) => this.serializeHomeworkAssignment(assignment, userId, isAdmin, false)),
                },
                attendanceSummary: {
                    present: (lesson.attendance || []).filter((item) => item.status === 'present').length,
                    late: (lesson.attendance || []).filter((item) => item.status === 'late').length,
                    absent: (lesson.attendance || []).filter((item) => item.status === 'absent').length,
                },
            };
        });
        const { __v, ...safeCourse } = course;
        return safeCourse;
    }
    canAccessLesson(course, userId, lessonIndex) {
        const ownerId = course.createdBy.toString();
        if (ownerId === userId)
            return true;
        const lesson = (course.lessons || [])[lessonIndex];
        if (!lesson || lesson.status === 'draft')
            return false;
        const isApprovedMember = (course.members || []).some((member) => member.userId?.toString() === userId && member.status === 'approved');
        if (!isApprovedMember) {
            return lessonIndex === 0;
        }
        if (lessonIndex === 0) {
            return true;
        }
        return this.getIncompleteRequiredTestsBeforeLesson(course, userId, lessonIndex)
            .length === 0;
    }
    canUserAccessLessonByIdentifier(course, userId, lessonId) {
        const lessonIndex = (course.lessons || []).findIndex((item) => item._id?.toString?.() === lessonId || item.urlSlug === lessonId);
        if (lessonIndex < 0) {
            return false;
        }
        return this.canAccessLesson(course, userId, lessonIndex);
    }
    findLessonByIdentifier(course, lessonId) {
        return (course.lessons || []).find((item) => item._id.toString() === lessonId || item.urlSlug === lessonId);
    }
    getAttendanceRecord(lesson, userId) {
        return (lesson.attendance || []).find((item) => item.userId?.toString() === userId);
    }
    normalizeHomeworkAssignments(lesson) {
        const rawHomework = lesson?.homework;
        if (Array.isArray(rawHomework)) {
            return rawHomework;
        }
        if (rawHomework && typeof rawHomework === 'object') {
            return [rawHomework];
        }
        return [];
    }
    ensureHomeworkAssignments(lesson) {
        const normalized = this.normalizeHomeworkAssignments(lesson);
        lesson.homework = normalized;
        return normalized;
    }
    serializeHomeworkSubmission(submission) {
        if (!submission)
            return null;
        return {
            userId: submission.userId,
            userName: submission.userName,
            userAvatar: submission.userAvatar,
            text: submission.text || '',
            link: submission.link || '',
            fileUrl: submission.fileUrl || '',
            fileName: submission.fileName || '',
            fileSize: submission.fileSize || 0,
            streamType: submission.streamType || 'direct',
            streamAssets: submission.streamAssets || [],
            hlsKeyAsset: '',
            status: submission.status || 'submitted',
            score: submission.score ?? null,
            feedback: submission.feedback || '',
            submittedAt: submission.submittedAt,
            reviewedAt: submission.reviewedAt || null,
        };
    }
    serializeHomeworkAssignment(assignment, userId, isOwner, includeOwnerSubmissions = true) {
        const selfSubmission = this.getHomeworkSubmission(assignment, userId);
        return {
            assignmentId: assignment._id?.toString?.() || assignment.id || '',
            enabled: Boolean(assignment.enabled),
            title: assignment.title || '',
            description: assignment.description || '',
            type: assignment.type || 'text',
            deadline: assignment.deadline || null,
            maxScore: assignment.maxScore || 100,
            submissionCount: (assignment.submissions || []).length,
            selfSubmission: this.serializeHomeworkSubmission(selfSubmission),
            submissions: isOwner && includeOwnerSubmissions
                ? (assignment.submissions || []).map((submission) => this.serializeHomeworkSubmission(submission))
                : undefined,
        };
    }
    findHomeworkAssignment(lesson, assignmentId) {
        const assignments = this.normalizeHomeworkAssignments(lesson);
        if (!assignmentId) {
            return assignments[0] || null;
        }
        return (assignments.find((assignment) => assignment?._id?.toString() === assignmentId ||
            String(assignment?.id || '') === assignmentId) || null);
    }
    getHomeworkSubmission(assignment, userId) {
        return (assignment?.submissions || []).find((item) => item.userId?.toString() === userId);
    }
    getOralAssessment(lesson, userId) {
        return (lesson?.oralAssessments || []).find((item) => item.userId?.toString() === userId);
    }
    getPublishedLessons(course) {
        return (course.lessons || []).filter((lesson) => (lesson.status || 'published') !== 'draft');
    }
    normalizeLessonLinkedTests(lesson) {
        return Array.isArray(lesson?.linkedTests) ? lesson.linkedTests : [];
    }
    normalizeLessonMediaItems(lesson) {
        if (Array.isArray(lesson?.mediaItems) && lesson.mediaItems.length) {
            return lesson.mediaItems;
        }
        if (lesson?.videoUrl || lesson?.fileUrl) {
            return [
                {
                    _id: new mongoose_2.Types.ObjectId(),
                    title: lesson.title || '',
                    videoUrl: lesson.videoUrl || '',
                    fileUrl: lesson.fileUrl || '',
                    fileName: lesson.fileName || '',
                    fileSize: lesson.fileSize || 0,
                    durationSeconds: lesson.durationSeconds || 0,
                    streamType: lesson.streamType || 'direct',
                    streamAssets: lesson.streamAssets || [],
                    hlsKeyAsset: lesson.hlsKeyAsset || '',
                },
            ];
        }
        return [];
    }
    normalizeLessonMaterials(lesson) {
        return Array.isArray(lesson?.materials) ? lesson.materials : [];
    }
    ensureLessonMaterials(lesson) {
        const normalized = this.normalizeLessonMaterials(lesson);
        lesson.materials = normalized;
        return normalized;
    }
    getLessonMediaPayload(item) {
        return {
            mediaId: item?._id?.toString?.() || '',
            title: item?.title || '',
            videoUrl: item?.videoUrl || '',
            fileUrl: item?.fileUrl || '',
            fileName: item?.fileName || '',
            fileSize: item?.fileSize || 0,
            durationSeconds: item?.durationSeconds || 0,
            streamType: item?.streamType || 'direct',
            streamAssets: item?.streamAssets || [],
        };
    }
    getLinkedTestProgress(linkedTest, userId) {
        return (linkedTest?.progress || []).find((item) => item?.userId?.toString?.() === userId);
    }
    serializeLinkedTestProgress(progress) {
        if (!progress)
            return null;
        return {
            userId: progress.userId,
            userName: progress.userName,
            userAvatar: progress.userAvatar,
            score: Number(progress.score || 0),
            total: Number(progress.total || 0),
            percent: Number(progress.percent || 0),
            bestPercent: Number(progress.bestPercent || 0),
            passed: Boolean(progress.passed),
            attemptsCount: Number(progress.attemptsCount || 0),
            completedAt: progress.completedAt || null,
        };
    }
    serializeLinkedTest(linkedTest, userId, isOwner) {
        const selfProgress = this.getLinkedTestProgress(linkedTest, userId);
        const resourceType = linkedTest?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
        const resourceId = linkedTest?.resourceId || linkedTest?.testId || '';
        return {
            linkedTestId: linkedTest?._id?.toString?.() || '',
            title: linkedTest?.title || '',
            url: linkedTest?.url || '',
            testId: resourceType === 'test' ? resourceId : '',
            resourceType,
            resourceId,
            shareShortCode: linkedTest?.shareShortCode || '',
            minimumScore: Math.max(0, Math.min(100, Number(linkedTest?.minimumScore || 0))),
            timeLimit: Math.max(0, Number(linkedTest?.timeLimit || 0)),
            showResults: linkedTest?.showResults !== false,
            requiredToUnlock: linkedTest?.requiredToUnlock !== false,
            selfProgress: this.serializeLinkedTestProgress(selfProgress),
            attemptsCount: isOwner ? Number((linkedTest?.progress || []).length) : undefined,
            passedCount: isOwner
                ? (linkedTest?.progress || []).filter((item) => item?.passed).length
                : undefined,
        };
    }
    getIncompleteRequiredTestsBeforeLesson(course, userId, lessonIndex) {
        const blockedBy = [];
        for (let index = 0; index < lessonIndex; index += 1) {
            const previousLesson = (course.lessons || [])[index];
            if (!previousLesson || (previousLesson.status || 'published') === 'draft') {
                continue;
            }
            for (const linkedTest of this.normalizeLessonLinkedTests(previousLesson)) {
                if (linkedTest?.requiredToUnlock === false) {
                    continue;
                }
                const selfProgress = this.getLinkedTestProgress(linkedTest, userId);
                if (!selfProgress?.passed) {
                    blockedBy.push({
                        lessonId: previousLesson._id?.toString?.() || previousLesson.urlSlug || '',
                        lessonTitle: previousLesson.title || '',
                        testTitle: linkedTest?.title || '',
                    });
                }
            }
        }
        return blockedBy;
    }
    parseLessonTestUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) {
            throw new common_1.BadRequestException('Test havolasini kiriting');
        }
        let pathname = value;
        try {
            pathname = new URL(value, 'http://localhost').pathname;
        }
        catch (error) {
            pathname = value;
        }
        const normalizedPath = pathname.replace(/\/+$/, '');
        const shareMatch = normalizedPath.match(/\/arena\/quiz-link\/([^/?#]+)/i);
        if (shareMatch?.[1]) {
            return {
                url: value,
                resourceType: 'test',
                identifier: String(shareMatch[1]).trim().toLowerCase(),
                isShared: true,
            };
        }
        const directMatch = normalizedPath.match(/\/arena\/quiz\/([^/?#]+)/i);
        if (directMatch?.[1]) {
            return {
                url: value,
                resourceType: 'test',
                identifier: String(directMatch[1]).trim(),
                isShared: false,
            };
        }
        const sentenceBuilderMatch = normalizedPath.match(/\/arena\/sentence-builder(?:s)?\/([^/?#]+)/i);
        if (sentenceBuilderMatch?.[1]) {
            return {
                url: value,
                resourceType: 'sentenceBuilder',
                identifier: String(sentenceBuilderMatch[1]).trim(),
                isShared: false,
            };
        }
        throw new common_1.BadRequestException("Faqat arena test yoki gap tuzish havolasi qo'llab-quvvatlanadi");
    }
    async resolveLessonLinkedTest(rawUrl, requestUserId) {
        const parsed = this.parseLessonTestUrl(rawUrl);
        if (parsed.resourceType === 'test' && parsed.isShared) {
            const shared = await this.arenaService.getSharedTestByShortCode(parsed.identifier, requestUserId);
            return {
                title: shared?.test?.title || '',
                url: parsed.url,
                resourceType: 'test',
                resourceId: String(shared?.test?._id || ''),
                shareShortCode: parsed.identifier,
                timeLimit: Math.max(0, Number(shared?.shareLink?.timeLimit || 0)),
                showResults: shared?.shareLink?.showResults !== false,
            };
        }
        if (parsed.resourceType === 'test') {
            const test = await this.arenaService.getTestById(parsed.identifier, requestUserId);
            return {
                title: test?.title || '',
                url: parsed.url,
                resourceType: 'test',
                resourceId: String(test?._id || parsed.identifier),
                shareShortCode: '',
                timeLimit: null,
                showResults: null,
            };
        }
        try {
            const deck = await this.arenaService.getSentenceBuilderDeckById(parsed.identifier, requestUserId);
            if (deck?.isPublic === false) {
                throw new common_1.ForbiddenException('Yopiq gap tuzish to‘plami uchun share havolasidan foydalaning');
            }
            return {
                title: deck?.title || '',
                url: parsed.url,
                resourceType: 'sentenceBuilder',
                resourceId: String(deck?._id || parsed.identifier),
                shareShortCode: '',
                timeLimit: Math.max(0, Number(deck?.timeLimit || 0)),
                showResults: deck?.showResults !== false,
            };
        }
        catch (error) {
            if (!(error instanceof common_1.NotFoundException)) {
                throw error;
            }
        }
        const sharedDeck = await this.arenaService.getSentenceBuilderDeckByShortCode(parsed.identifier, requestUserId);
        return {
            title: sharedDeck?.deck?.title || '',
            url: parsed.url,
            resourceType: 'sentenceBuilder',
            resourceId: String(sharedDeck?.deck?._id || ''),
            shareShortCode: parsed.identifier,
            timeLimit: Math.max(0, Number(sharedDeck?.shareLink?.timeLimit || 0)),
            showResults: sharedDeck?.shareLink?.showResults !== false,
        };
    }
    normalizeSentenceBuilderLessonAnswers(items) {
        if (!Array.isArray(items))
            return [];
        return items
            .map((item) => ({
            questionIndex: Number(item?.questionIndex),
            selectedTokens: Array.isArray(item?.selectedTokens)
                ? item.selectedTokens
                    .map((token) => String(token || '').trim())
                    .filter(Boolean)
                : [],
        }))
            .filter((item) => Number.isInteger(item.questionIndex) && item.questionIndex >= 0);
    }
    getAttendanceScore(record) {
        if (!record)
            return 0;
        const progress = Math.max(0, Math.min(100, Number(record.progressPercent || 0)));
        if (record.status === 'present')
            return Math.max(progress, 100);
        if (record.status === 'late')
            return Math.max(progress, 60);
        return 0;
    }
    getHomeworkPercent(assignment, submission) {
        if (!assignment?.enabled)
            return null;
        const maxScore = Math.max(1, Number(assignment?.maxScore || 100));
        if (submission?.score !== null && submission?.score !== undefined) {
            return Math.max(0, Math.min(100, Math.round((Number(submission.score) / maxScore) * 100)));
        }
        if (submission?.status === 'submitted')
            return 50;
        if (submission?.status === 'needs_revision')
            return 35;
        return 0;
    }
    getPerformanceLabel(score) {
        if (score >= 86)
            return 'excellent';
        if (score >= 71)
            return 'good';
        if (score >= 51)
            return 'average';
        if (score > 0)
            return 'needs_attention';
        return 'no_activity';
    }
    buildLessonGradeRow(lesson, member) {
        const attendance = this.getAttendanceRecord(lesson, member.userId.toString());
        const oralAssessment = this.getOralAssessment(lesson, member.userId.toString());
        const assignments = this.normalizeHomeworkAssignments(lesson).filter((assignment) => assignment?.enabled);
        const homeworkPercents = assignments
            .map((assignment) => this.getHomeworkPercent(assignment, this.getHomeworkSubmission(assignment, member.userId.toString())))
            .filter((value) => value !== null);
        const reviewedCount = assignments.filter((assignment) => {
            const submission = this.getHomeworkSubmission(assignment, member.userId.toString());
            return submission?.status === 'reviewed';
        }).length;
        const submittedCount = assignments.filter((assignment) => Boolean(this.getHomeworkSubmission(assignment, member.userId.toString()))).length;
        const attendanceScore = this.getAttendanceScore(attendance);
        const oralScore = oralAssessment?.score === null || oralAssessment?.score === undefined
            ? null
            : Math.max(0, Math.min(100, Number(oralAssessment.score || 0)));
        const homeworkPercent = homeworkPercents.length
            ? Math.round(homeworkPercents.reduce((sum, value) => sum + value, 0) /
                homeworkPercents.length)
            : null;
        let lessonScore = attendanceScore;
        if (homeworkPercent !== null && oralScore !== null) {
            lessonScore = Math.round(attendanceScore * 0.25 + homeworkPercent * 0.45 + oralScore * 0.3);
        }
        else if (homeworkPercent !== null) {
            lessonScore = Math.round(attendanceScore * 0.4 + homeworkPercent * 0.6);
        }
        else if (oralScore !== null) {
            lessonScore = Math.round(attendanceScore * 0.35 + oralScore * 0.65);
        }
        return {
            userId: member.userId,
            userName: member.name,
            userAvatar: member.avatar,
            attendanceStatus: attendance?.status || 'absent',
            attendanceProgress: attendance?.progressPercent || 0,
            attendanceScore,
            homeworkEnabled: assignments.length > 0,
            homeworkStatus: reviewedCount === assignments.length && assignments.length > 0
                ? 'reviewed'
                : submittedCount > 0
                    ? 'submitted'
                    : 'missing',
            homeworkSubmitted: submittedCount > 0,
            homeworkAssignments: assignments.length,
            homeworkSubmittedCount: submittedCount,
            homeworkReviewedCount: reviewedCount,
            homeworkScore: null,
            homeworkPercent,
            oralScore,
            oralNote: oralAssessment?.note || '',
            oralUpdatedAt: oralAssessment?.updatedAt || null,
            feedback: '',
            lessonScore,
            performance: this.getPerformanceLabel(lessonScore),
        };
    }
    buildCourseOverview(course, members) {
        const lessons = this.getPublishedLessons(course);
        const totalLessons = lessons.length;
        const students = members.map((member) => {
            const lessonRows = lessons.map((lesson) => this.buildLessonGradeRow(lesson, member));
            const oralScores = lessonRows
                .map((row) => row.oralScore)
                .filter((value) => value !== null && value !== undefined);
            const averageScore = lessonRows.length
                ? Math.round(lessonRows.reduce((sum, row) => sum + row.lessonScore, 0) /
                    lessonRows.length)
                : 0;
            const oralAverage = oralScores.length
                ? Math.round(oralScores.reduce((sum, score) => sum + score, 0) /
                    oralScores.length)
                : null;
            const presentCount = lessonRows.filter((row) => row.attendanceStatus === 'present').length;
            const lateCount = lessonRows.filter((row) => row.attendanceStatus === 'late').length;
            const homeworkCompleted = lessonRows.filter((row) => row.homeworkSubmitted).length;
            const reviewedHomework = lessonRows.filter((row) => row.homeworkStatus === 'reviewed').length;
            return {
                userId: member.userId,
                userName: member.name,
                userAvatar: member.avatar,
                averageScore,
                oralAverage,
                performance: this.getPerformanceLabel(averageScore),
                attendanceRate: totalLessons > 0
                    ? Math.round(((presentCount + lateCount * 0.5) / totalLessons) * 100)
                    : 0,
                presentCount,
                lateCount,
                absentCount: Math.max(totalLessons - presentCount - lateCount, 0),
                homeworkCompleted,
                reviewedHomework,
                totalLessons,
            };
        });
        const averageScore = students.length
            ? Math.round(students.reduce((sum, student) => sum + student.averageScore, 0) /
                students.length)
            : 0;
        return {
            totalStudents: students.length,
            totalLessons,
            averageScore,
            activeStudents: students.filter((student) => student.averageScore > 0).length,
            attentionCount: students.filter((student) => student.performance === 'needs_attention' ||
                student.performance === 'no_activity').length,
            students,
        };
    }
    async cleanupHomeworkSubmissionAssets(submission) {
        for (const asset of submission?.streamAssets || []) {
            await this.r2Service
                .deleteFile(asset)
                .catch((error) => console.error(`Failed to delete homework stream asset ${asset}:`, error));
        }
        if (submission?.hlsKeyAsset) {
            await this.r2Service
                .deleteFile(submission.hlsKeyAsset)
                .catch((error) => console.error(`Failed to delete homework HLS key ${submission.hlsKeyAsset}:`, error));
        }
        if (submission?.fileUrl) {
            await this.r2Service
                .deleteFile(submission.fileUrl)
                .catch((error) => console.error(`Failed to delete homework file ${submission.fileUrl}:`, error));
        }
    }
    async cleanupLessonMediaItemAssets(item) {
        for (const asset of item?.streamAssets || []) {
            await this.r2Service.deleteFile(asset).catch((error) => console.error(`Failed to delete lesson stream asset ${asset}:`, error));
        }
        if (item?.hlsKeyAsset) {
            await this.r2Service.deleteFile(item.hlsKeyAsset).catch((error) => console.error(`Failed to delete lesson hls key ${item.hlsKeyAsset}:`, error));
        }
        if (item?.fileUrl) {
            await this.r2Service.deleteFile(item.fileUrl).catch((error) => console.error(`Failed to delete lesson file ${item.fileUrl}:`, error));
        }
        if (item?.videoUrl && item?.videoUrl !== item?.fileUrl) {
            await this.r2Service.deleteFile(item.videoUrl).catch((error) => console.error(`Failed to delete lesson video ${item.videoUrl}:`, error));
        }
    }
    async cleanupLessonMaterialAssets(item) {
        if (!item?.fileUrl)
            return;
        await this.r2Service.deleteFile(item.fileUrl).catch((error) => console.error(`Failed to delete lesson material ${item.fileUrl}:`, error));
    }
    async getAllCoursesForUser(userId, pagination = { page: 1, limit: 15 }) {
        const skip = (pagination.page - 1) * pagination.limit;
        const [courses, total] = await Promise.all([
            this.courseModel
                .find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pagination.limit)
                .lean()
                .exec(),
            this.courseModel.countDocuments(),
        ]);
        const hydratedCourses = await Promise.all(courses.map((course) => this.hydrateCourseCollections(course)));
        return {
            data: hydratedCourses.map((c) => this.sanitizeCourse(c, userId)),
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }
    async getCourseForUser(id, userId) {
        const isObjectId = mongoose_2.Types.ObjectId.isValid(id) && String(new mongoose_2.Types.ObjectId(id)) === id;
        const query = isObjectId
            ? { $or: [{ _id: id }, { urlSlug: id }] }
            : { urlSlug: id };
        const course = await this.courseModel.findOne(query).lean().exec();
        if (!course)
            throw new common_1.NotFoundException('Kurs topilmadi');
        const hydratedCourse = await this.hydrateCourseCollections(course);
        return this.sanitizeCourse(hydratedCourse, userId);
    }
    async findAll() {
        const courses = await this.courseModel.find().sort({ createdAt: -1 }).lean().exec();
        return Promise.all(courses.map((course) => this.hydrateCourseCollections(course)));
    }
    async findById(id) {
        const isObjectId = mongoose_2.Types.ObjectId.isValid(id) && String(new mongoose_2.Types.ObjectId(id)) === id;
        const query = isObjectId
            ? { $or: [{ _id: id }, { urlSlug: id }] }
            : { urlSlug: id };
        const course = await this.courseModel.findOne(query).lean().exec();
        if (!course)
            throw new common_1.NotFoundException('Kurs topilmadi');
        return (await this.hydrateCourseCollections(course));
    }
    async create(userId, dto) {
        const user = await this.userModel.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('Foydalanuvchi topilmadi');
        (0, app_limits_1.assertMaxChars)('Kurs nomi', dto.name, app_limits_1.APP_TEXT_LIMITS.courseNameChars);
        (0, app_limits_1.assertMaxChars)('Kurs tavsifi', dto.description, app_limits_1.APP_TEXT_LIMITS.courseDescriptionChars);
        (0, app_limits_1.assertMaxChars)('Kurs kategoriyasi', dto.category, app_limits_1.APP_TEXT_LIMITS.courseCategoryChars);
        const limit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.coursesCreated, user.premiumStatus);
        const existingCoursesCount = await this.courseModel.countDocuments({
            createdBy: new mongoose_2.Types.ObjectId(userId),
        });
        if (existingCoursesCount >= limit) {
            throw new common_1.ForbiddenException(`Siz maksimal ${limit} ta kurs yarata olasiz`);
        }
        const finalSlug = await this.generateUniqueCourseSlug(dto.urlSlug);
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
        const createdCourse = await this.courseModel.create({
            ...dto,
            urlSlug: finalSlug,
            gradient,
            createdBy: new mongoose_2.Types.ObjectId(userId),
        });
        await this.persistCourseCollections({
            ...createdCourse.toObject(),
            members: [],
            lessons: [],
        });
        return this.findById(createdCourse._id.toString());
    }
    async delete(courseId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Siz bu kursni o'chira olmaysiz");
        }
        for (const lesson of course.lessons) {
            for (const item of this.normalizeLessonMediaItems(lesson)) {
                await this.cleanupLessonMediaItemAssets(item);
            }
            for (const material of this.normalizeLessonMaterials(lesson)) {
                await this.cleanupLessonMaterialAssets(material);
            }
            for (const assignment of this.normalizeHomeworkAssignments(lesson)) {
                for (const submission of assignment?.submissions || []) {
                    await this.cleanupHomeworkSubmissionAssets(submission);
                }
            }
        }
        await Promise.all([
            this.courseModel.findByIdAndDelete(course._id).exec(),
            this.courseMemberRecordModel.deleteMany({ courseId: course._id }),
            this.courseLessonRecordModel.deleteMany({ courseId: course._id }),
            this.lessonHomeworkRecordModel.deleteMany({ courseId: course._id }),
        ]);
    }
    async addLesson(courseId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars qo'sha oladi");
        }
        const user = await this.userModel.findById(userId);
        const limit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.lessonsPerCourse, user?.premiumStatus);
        if (course.lessons.length >= limit) {
            throw new common_1.ForbiddenException(`Har bir kursda maksimal ${limit} ta dars bo'lishi mumkin`);
        }
        (0, app_limits_1.assertMaxChars)('Dars sarlavhasi', dto.title, app_limits_1.APP_TEXT_LIMITS.lessonTitleChars);
        (0, app_limits_1.assertMaxChars)('Dars tavsifi', dto.description, app_limits_1.APP_TEXT_LIMITS.lessonDescriptionChars);
        const normalizedMediaItems = Array.isArray(dto.mediaItems)
            ? dto.mediaItems
                .map((item) => ({
                _id: new mongoose_2.Types.ObjectId(),
                title: String(item?.title || dto.title || '').trim(),
                videoUrl: String(item?.videoUrl || '').trim(),
                fileUrl: String(item?.fileUrl || '').trim(),
                fileName: String(item?.fileName || '').trim(),
                fileSize: Math.max(0, Number(item?.fileSize || 0)),
                durationSeconds: Math.max(0, Number(item?.durationSeconds || 0)),
                streamType: item?.streamType === 'hls' ? 'hls' : 'direct',
                streamAssets: Array.isArray(item?.streamAssets) ? item.streamAssets : [],
                hlsKeyAsset: String(item?.hlsKeyAsset || '').trim(),
            }))
                .filter((item) => item.videoUrl || item.fileUrl)
            : [];
        const totalMediaBytes = normalizedMediaItems.reduce((sum, item) => sum + Number(item.fileSize || 0), 0);
        const lessonVideosLimit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.lessonVideosPerLesson, user?.premiumStatus);
        if (normalizedMediaItems.length > lessonVideosLimit) {
            throw new common_1.ForbiddenException(`Bu tarifda bitta darsga maksimal ${lessonVideosLimit} ta video yuklash mumkin`);
        }
        if (totalMediaBytes > app_limits_1.APP_LIMITS.lessonMediaBytes) {
            throw new common_1.ForbiddenException('Bitta darsga yuklanadigan videolar jami 200MB dan oshmasligi kerak');
        }
        const primaryMedia = normalizedMediaItems[0] || null;
        const finalSlug = this.generateUniqueLessonSlug(course, dto.urlSlug);
        course.lessons.push({
            title: dto.title,
            type: normalizedMediaItems.length ? 'file' : dto.type || 'video',
            videoUrl: primaryMedia?.videoUrl || dto.videoUrl || '',
            fileUrl: primaryMedia?.fileUrl || dto.fileUrl || '',
            fileName: primaryMedia?.fileName || dto.fileName || '',
            fileSize: primaryMedia?.fileSize || dto.fileSize || 0,
            durationSeconds: primaryMedia?.durationSeconds || Math.max(0, Number(dto.durationSeconds || 0)),
            mediaItems: normalizedMediaItems,
            streamType: primaryMedia?.streamType || dto.streamType || 'direct',
            streamAssets: primaryMedia?.streamAssets || dto.streamAssets || [],
            hlsKeyAsset: primaryMedia?.hlsKeyAsset || dto.hlsKeyAsset || '',
            urlSlug: finalSlug,
            description: dto.description || '',
            status: dto.status === 'published' ? 'published' : 'draft',
            publishedAt: dto.status === 'published' ? new Date() : null,
            views: 0,
            addedAt: new Date(),
            comments: [],
        });
        const savedCourse = await course.save();
        await this.syncCourseMirrorCollections(savedCourse.toObject());
        return savedCourse;
    }
    async updateLesson(courseId, lessonId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi darsni tahrirlay oladi");
        }
        const user = await this.userModel.findById(userId);
        const lesson = course.lessons.find((item) => item._id.toString() === lessonId || item.urlSlug === lessonId);
        if (!lesson) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        const previousLessonState = {
            type: lesson.type || 'video',
            videoUrl: lesson.videoUrl || '',
            fileUrl: lesson.fileUrl || '',
            mediaItems: this.normalizeLessonMediaItems(lesson).map((item) => ({
                videoUrl: item.videoUrl || '',
                fileUrl: item.fileUrl || '',
                durationSeconds: Number(item.durationSeconds || 0),
                streamAssets: Array.isArray(item.streamAssets) ? [...item.streamAssets] : [],
                hlsKeyAsset: item.hlsKeyAsset || '',
            })),
            streamAssets: Array.isArray(lesson.streamAssets)
                ? [...lesson.streamAssets]
                : [],
            hlsKeyAsset: lesson.hlsKeyAsset || '',
        };
        if (dto.title !== undefined) {
            (0, app_limits_1.assertMaxChars)('Dars sarlavhasi', dto.title, app_limits_1.APP_TEXT_LIMITS.lessonTitleChars);
            lesson.title = dto.title || lesson.title;
        }
        if (dto.description !== undefined) {
            (0, app_limits_1.assertMaxChars)('Dars tavsifi', dto.description, app_limits_1.APP_TEXT_LIMITS.lessonDescriptionChars);
            lesson.description = dto.description || '';
        }
        if (dto.mediaItems !== undefined) {
            const normalizedMediaItems = Array.isArray(dto.mediaItems)
                ? dto.mediaItems
                    .map((item) => ({
                    _id: new mongoose_2.Types.ObjectId(),
                    title: String(item?.title || dto.title || lesson.title || '').trim(),
                    videoUrl: String(item?.videoUrl || '').trim(),
                    fileUrl: String(item?.fileUrl || '').trim(),
                    fileName: String(item?.fileName || '').trim(),
                    fileSize: Math.max(0, Number(item?.fileSize || 0)),
                    durationSeconds: Math.max(0, Number(item?.durationSeconds || 0)),
                    streamType: item?.streamType === 'hls' ? 'hls' : 'direct',
                    streamAssets: Array.isArray(item?.streamAssets) ? item.streamAssets : [],
                    hlsKeyAsset: String(item?.hlsKeyAsset || '').trim(),
                }))
                    .filter((item) => item.videoUrl || item.fileUrl)
                : [];
            const totalMediaBytes = normalizedMediaItems.reduce((sum, item) => sum + Number(item.fileSize || 0), 0);
            const lessonVideosLimit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.lessonVideosPerLesson, user?.premiumStatus);
            if (normalizedMediaItems.length > lessonVideosLimit) {
                throw new common_1.ForbiddenException(`Bu tarifda bitta darsga maksimal ${lessonVideosLimit} ta video yuklash mumkin`);
            }
            if (totalMediaBytes > app_limits_1.APP_LIMITS.lessonMediaBytes) {
                throw new common_1.ForbiddenException('Bitta darsga yuklanadigan videolar jami 200MB dan oshmasligi kerak');
            }
            lesson.mediaItems = normalizedMediaItems;
            const primaryMedia = normalizedMediaItems[0] || null;
            lesson.type = normalizedMediaItems.length ? 'file' : lesson.type;
            lesson.videoUrl = primaryMedia?.videoUrl || '';
            lesson.fileUrl = primaryMedia?.fileUrl || '';
            lesson.fileName = primaryMedia?.fileName || '';
            lesson.fileSize = primaryMedia?.fileSize || 0;
            lesson.durationSeconds = primaryMedia?.durationSeconds || 0;
            lesson.streamType = primaryMedia?.streamType || 'direct';
            lesson.streamAssets = primaryMedia?.streamAssets || [];
            lesson.hlsKeyAsset = primaryMedia?.hlsKeyAsset || '';
        }
        if (dto.type !== undefined)
            lesson.type = dto.type || lesson.type;
        if (dto.videoUrl !== undefined)
            lesson.videoUrl = dto.videoUrl || '';
        if (dto.fileUrl !== undefined)
            lesson.fileUrl = dto.fileUrl || '';
        if (dto.fileName !== undefined)
            lesson.fileName = dto.fileName || '';
        if (dto.fileSize !== undefined)
            lesson.fileSize = dto.fileSize || 0;
        if (dto.durationSeconds !== undefined) {
            lesson.durationSeconds = Math.max(0, Number(dto.durationSeconds || 0));
        }
        if (dto.streamType !== undefined)
            lesson.streamType = dto.streamType || 'direct';
        if (dto.streamAssets !== undefined)
            lesson.streamAssets = dto.streamAssets || [];
        if (dto.hlsKeyAsset !== undefined)
            lesson.hlsKeyAsset = dto.hlsKeyAsset || '';
        const streamAssetsChanged = dto.streamAssets !== undefined &&
            JSON.stringify(previousLessonState.streamAssets) !==
                JSON.stringify(lesson.streamAssets || []);
        const keyAssetChanged = dto.hlsKeyAsset !== undefined &&
            previousLessonState.hlsKeyAsset !== (lesson.hlsKeyAsset || '');
        const fileUrlChanged = dto.fileUrl !== undefined &&
            previousLessonState.fileUrl !== (lesson.fileUrl || '');
        const videoUrlChanged = dto.videoUrl !== undefined &&
            previousLessonState.videoUrl !== (lesson.videoUrl || '');
        const typeChanged = dto.type !== undefined && previousLessonState.type !== lesson.type;
        if (streamAssetsChanged) {
            for (const asset of previousLessonState.streamAssets) {
                if (!(lesson.streamAssets || []).includes(asset)) {
                    await this.r2Service
                        .deleteFile(asset)
                        .catch((error) => console.error(`Failed to delete replaced stream asset ${asset}:`, error));
                }
            }
        }
        if (keyAssetChanged && previousLessonState.hlsKeyAsset) {
            await this.r2Service
                .deleteFile(previousLessonState.hlsKeyAsset)
                .catch((error) => console.error(`Failed to delete replaced HLS key ${previousLessonState.hlsKeyAsset}:`, error));
        }
        if (fileUrlChanged && previousLessonState.fileUrl) {
            await this.r2Service
                .deleteFile(previousLessonState.fileUrl)
                .catch((error) => console.error(`Failed to delete replaced lesson file ${previousLessonState.fileUrl}:`, error));
        }
        if ((videoUrlChanged || typeChanged) &&
            previousLessonState.type === 'file' &&
            previousLessonState.videoUrl &&
            previousLessonState.videoUrl !== lesson.videoUrl) {
            await this.r2Service
                .deleteFile(previousLessonState.videoUrl)
                .catch((error) => console.error(`Failed to delete replaced lesson media ${previousLessonState.videoUrl}:`, error));
        }
        if (dto.mediaItems !== undefined) {
            for (const oldItem of previousLessonState.mediaItems || []) {
                const stillExists = (lesson.mediaItems || []).some((item) => item?.videoUrl === oldItem.videoUrl &&
                    item?.fileUrl === oldItem.fileUrl &&
                    JSON.stringify(item?.streamAssets || []) ===
                        JSON.stringify(oldItem.streamAssets || []));
                if (!stillExists) {
                    await this.cleanupLessonMediaItemAssets(oldItem);
                }
            }
        }
        if (!lesson.videoUrl && !lesson.fileUrl) {
            lesson.status = 'draft';
            lesson.publishedAt = null;
        }
        const savedCourse = await course.save();
        await this.syncCourseMirrorCollections(savedCourse.toObject());
        return savedCourse;
    }
    async publishLesson(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi darsni e'lon qila oladi");
        }
        const lesson = course.lessons.find((item) => item._id.toString() === lessonId || item.urlSlug === lessonId);
        if (!lesson) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        const hasMedia = this.normalizeLessonMediaItems(lesson).length > 0;
        if (!hasMedia) {
            throw new common_1.ForbiddenException("Darsni e'lon qilish uchun avval video yoki fayl biriktiring");
        }
        lesson.status = 'published';
        lesson.publishedAt = new Date();
        const savedCourse = await course.save();
        await this.syncCourseMirrorCollections(savedCourse.toObject());
        return savedCourse;
    }
    async removeLesson(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars o'chira oladi");
        }
        const lessonObj = course.lessons.find((l) => l._id.toString() === lessonId);
        if (lessonObj) {
            for (const item of this.normalizeLessonMediaItems(lessonObj)) {
                await this.cleanupLessonMediaItemAssets(item);
            }
            for (const material of this.normalizeLessonMaterials(lessonObj)) {
                await this.cleanupLessonMaterialAssets(material);
            }
            for (const assignment of this.normalizeHomeworkAssignments(lessonObj)) {
                for (const submission of assignment?.submissions || []) {
                    await this.cleanupHomeworkSubmissionAssets(submission);
                }
            }
        }
        course.lessons = course.lessons.filter((l) => l._id.toString() !== lessonId);
        const savedCourse = await course.save();
        await this.syncCourseMirrorCollections(savedCourse.toObject());
        return savedCourse;
    }
    async incrementViews(courseId, lessonId) {
        const course = await this.findById(courseId);
        const lesson = course.lessons.find((l) => l._id.toString() === lessonId || l.urlSlug === lessonId);
        if (!lesson)
            return;
        await this.courseLessonRecordModel
            .updateOne({ courseId: course._id, lessonId: lesson._id }, { $inc: { views: 1 } })
            .exec();
        lesson.views = Number(lesson.views || 0) + 1;
    }
    async toggleLessonLike(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1)
            throw new common_1.NotFoundException('Dars topilmadi');
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu darsga like bosish uchun avval kursga kiring");
        }
        const lesson = course.lessons[lessonIndex];
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const alreadyLiked = (lesson.likes || []).some((id) => id.equals(userObjectId));
        if (alreadyLiked) {
            lesson.likes = (lesson.likes || []).filter((id) => !id.equals(userObjectId));
        }
        else {
            lesson.likes = [...(lesson.likes || []), userObjectId];
        }
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return {
            liked: !alreadyLiked,
            likes: lesson.likes.length,
        };
    }
    async getLikedLessons(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const lessonRows = await this.courseLessonRecordModel
            .find({ likes: userObjectId })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(50)
            .lean()
            .exec();
        const courseIds = Array.from(new Set(lessonRows.map((item) => item.courseId?.toString?.()).filter(Boolean)));
        const courses = await this.courseModel
            .find({ _id: { $in: courseIds.map((id) => new mongoose_2.Types.ObjectId(id)) } })
            .lean()
            .exec();
        const courseMap = new Map(courses.map((course) => [course._id.toString(), course]));
        return lessonRows
            .map((lesson) => {
            const course = courseMap.get(lesson.courseId?.toString?.() || '');
            if (!course)
                return null;
            return {
                _id: lesson.lessonId,
                title: lesson.title,
                description: lesson.description,
                likes: Array.isArray(lesson.likes) ? lesson.likes.length : 0,
                views: Number(lesson.views || 0),
                urlSlug: lesson.urlSlug,
                addedAt: lesson.addedAt,
                course: {
                    _id: course._id,
                    name: course.name,
                    image: course.image,
                    urlSlug: course.urlSlug,
                },
            };
        })
            .filter(Boolean);
    }
    async getLessonAttendance(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu dars davomatini ko'rish huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        const isOwner = course.createdBy.toString() === userId;
        const selfRecord = this.getAttendanceRecord(lesson, userId);
        if (!isOwner) {
            return {
                lessonId: lesson._id.toString(),
                self: selfRecord
                    ? {
                        userId: selfRecord.userId,
                        userName: selfRecord.userName,
                        userAvatar: selfRecord.userAvatar,
                        status: selfRecord.status,
                        progressPercent: selfRecord.progressPercent || 0,
                        source: selfRecord.source || 'auto',
                        markedAt: selfRecord.markedAt,
                    }
                    : null,
            };
        }
        const approvedMembers = (course.members || []).filter((member) => member.status === 'approved');
        const recordMap = new Map((lesson.attendance || []).map((record) => [
            record.userId.toString(),
            record,
        ]));
        const members = approvedMembers.map((member) => {
            const record = recordMap.get(member.userId.toString());
            return {
                userId: member.userId,
                userName: member.name,
                userAvatar: member.avatar,
                status: record?.status || 'absent',
                progressPercent: record?.progressPercent || 0,
                source: record?.source || 'manual',
                markedAt: record?.markedAt || null,
            };
        });
        return {
            lessonId: lesson._id.toString(),
            summary: {
                present: members.filter((member) => member.status === 'present')
                    .length,
                late: members.filter((member) => member.status === 'late').length,
                absent: members.filter((member) => member.status === 'absent')
                    .length,
            },
            members,
        };
    }
    async markOwnAttendance(courseId, lessonId, user, dto) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1)
            throw new common_1.NotFoundException('Dars topilmadi');
        if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
            throw new common_1.ForbiddenException("Bu darsga davomat belgilab bo'lmaydi");
        }
        const lesson = course.lessons[lessonIndex];
        const progressPercent = Math.max(0, Number(dto.progressPercent || 0));
        const existingRecord = this.getAttendanceRecord(lesson, user._id.toString());
        if (existingRecord) {
            const nextProgressPercent = Number(existingRecord.progressPercent || 0) + progressPercent;
            const nextStatus = existingRecord.status === 'present' || nextProgressPercent >= 70
                ? 'present'
                : 'late';
            existingRecord.status = nextStatus;
            existingRecord.progressPercent = Number(nextProgressPercent.toFixed(2));
            existingRecord.source = 'auto';
            existingRecord.markedAt = new Date();
        }
        else {
            const nextStatus = progressPercent >= 70 ? 'present' : 'late';
            lesson.attendance.push({
                userId: new mongoose_2.Types.ObjectId(user._id),
                userName: user.nickname || user.username,
                userAvatar: user.avatar ||
                    (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
                status: nextStatus,
                progressPercent,
                source: 'auto',
                markedAt: new Date(),
            });
        }
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        const record = this.getAttendanceRecord(lesson, user._id.toString());
        return {
            status: record?.status || (progressPercent >= 70 ? 'present' : 'late'),
            progressPercent: record?.progressPercent || progressPercent,
        };
    }
    async setAttendanceStatus(courseId, lessonId, targetUserId, adminId, status) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi davomatni o'zgartira oladi");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const member = (course.members || []).find((item) => item.userId.toString() === targetUserId && item.status === 'approved');
        if (!member) {
            throw new common_1.NotFoundException("Kurs a'zosi topilmadi");
        }
        const normalizedStatus = ['present', 'late', 'absent'].includes(status)
            ? status
            : 'absent';
        const existingRecord = this.getAttendanceRecord(lesson, targetUserId);
        if (existingRecord) {
            existingRecord.status = normalizedStatus;
            existingRecord.source = 'manual';
            existingRecord.markedAt = new Date();
        }
        else {
            lesson.attendance.push({
                userId: member.userId,
                userName: member.name,
                userAvatar: member.avatar,
                status: normalizedStatus,
                progressPercent: 0,
                source: 'manual',
                markedAt: new Date(),
            });
        }
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonAttendance(courseId, lessonId, adminId);
    }
    async getLessonHomework(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu dars uyga vazifasini ko'rish huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        const homeworkAssignments = this.ensureHomeworkAssignments(lesson);
        const isOwner = course.createdBy.toString() === userId;
        if (!homeworkAssignments.length) {
            return {
                assignments: [],
            };
        }
        return {
            assignments: homeworkAssignments.map((assignment) => this.serializeHomeworkAssignment(assignment, userId, isOwner)),
        };
    }
    async upsertLessonHomework(courseId, lessonId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi uyga vazifani boshqarishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const assignments = this.ensureHomeworkAssignments(lesson);
        const existingAssignment = this.findHomeworkAssignment(lesson, dto.assignmentId);
        if (!existingAssignment) {
            const premiumStatus = await this.getUserPremiumStatus(userId);
            const assignmentLimit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.lessonHomeworkPerLesson, premiumStatus);
            if (assignments.length >= assignmentLimit) {
                throw new common_1.ForbiddenException(`Bu tarifda bitta dars uchun maksimal ${assignmentLimit} ta uyga vazifa qo'shish mumkin`);
            }
        }
        const homework = existingAssignment ||
            {
                enabled: true,
                title: '',
                description: '',
                type: 'text',
                deadline: null,
                maxScore: 100,
                submissions: [],
            };
        if (dto.title !== undefined) {
            (0, app_limits_1.assertMaxChars)('Uyga vazifa sarlavhasi', dto.title, app_limits_1.APP_TEXT_LIMITS.lessonTitleChars);
            homework.title = dto.title || '';
        }
        if (dto.description !== undefined) {
            (0, app_limits_1.assertMaxChars)('Uyga vazifa tavsifi', dto.description, app_limits_1.APP_TEXT_LIMITS.lessonDescriptionChars);
            homework.description = dto.description || '';
        }
        if (dto.type !== undefined) {
            homework.type = ['text', 'audio', 'video', 'pdf', 'photo'].includes(dto.type)
                ? dto.type
                : 'text';
        }
        if (dto.enabled !== undefined) {
            homework.enabled = Boolean(dto.enabled);
        }
        if (dto.deadline !== undefined) {
            homework.deadline = dto.deadline ? new Date(dto.deadline) : null;
        }
        if (dto.maxScore !== undefined) {
            homework.maxScore = Math.max(1, Math.min(100, Number(dto.maxScore || 100)));
        }
        if (!homework.enabled) {
            homework.enabled = false;
            if (!assignments.some((item) => item === homework)) {
                assignments.push(homework);
            }
            lesson.homework = assignments;
            await course.save();
            await this.syncCourseMirrorCollections(course.toObject());
            return this.getLessonHomework(courseId, lessonId, userId);
        }
        const nextHomework = {
            ...homework,
            enabled: true,
            type: homework.type || 'text',
            submissions: Array.isArray(homework.submissions) ? homework.submissions : [],
        };
        const persistedAssignmentId = nextHomework?._id?.toString?.();
        const existingIndex = persistedAssignmentId
            ? assignments.findIndex((item) => item?._id?.toString?.() === persistedAssignmentId)
            : -1;
        if (existingIndex === -1) {
            assignments.push(nextHomework);
        }
        else {
            assignments[existingIndex] = nextHomework;
        }
        lesson.homework = assignments;
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonHomework(courseId, lessonId, userId);
    }
    async deleteLessonHomework(courseId, lessonId, assignmentId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi uyga vazifani boshqarishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const assignments = this.ensureHomeworkAssignments(lesson);
        const assignment = this.findHomeworkAssignment(lesson, assignmentId);
        if (!assignment) {
            throw new common_1.NotFoundException('Uyga vazifa topilmadi');
        }
        for (const submission of assignment.submissions || []) {
            await this.cleanupHomeworkSubmissionAssets(submission);
        }
        lesson.homework = assignments.filter((item) => item?._id?.toString?.() !== assignmentId);
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonHomework(courseId, lessonId, userId);
    }
    async getLessonMaterials(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu dars materiallarini ko'rish huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        return {
            items: this.normalizeLessonMaterials(lesson).map((item) => ({
                materialId: item?._id?.toString?.() || '',
                title: item?.title || '',
                fileUrl: item?.fileUrl || '',
                fileName: item?.fileName || '',
                fileSize: Number(item?.fileSize || 0),
            })),
        };
    }
    async upsertLessonMaterial(courseId, lessonId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars materiallarini boshqarishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const materials = this.ensureLessonMaterials(lesson);
        const existingMaterial = dto.materialId
            ? materials.find((item) => item?._id?.toString?.() === dto.materialId) || null
            : null;
        const material = existingMaterial ||
            {
                title: '',
                fileUrl: '',
                fileName: '',
                fileSize: 0,
            };
        if (dto.title !== undefined) {
            (0, app_limits_1.assertMaxChars)('Dars materiali sarlavhasi', dto.title, app_limits_1.APP_TEXT_LIMITS.lessonTitleChars);
            material.title = dto.title || '';
        }
        if (dto.fileUrl !== undefined) {
            material.fileUrl = String(dto.fileUrl || '').trim();
        }
        if (dto.fileName !== undefined) {
            material.fileName = String(dto.fileName || '').trim();
        }
        if (dto.fileSize !== undefined) {
            material.fileSize = Math.max(0, Number(dto.fileSize || 0));
        }
        if (!material.fileUrl) {
            throw new common_1.BadRequestException("Material uchun PDF fayl biriktirish kerak");
        }
        if (material.fileName &&
            !String(material.fileName).toLowerCase().endsWith('.pdf')) {
            throw new common_1.BadRequestException("Dars materiali faqat PDF bo'lishi mumkin");
        }
        const persistedMaterialId = material?._id?.toString?.();
        const existingIndex = persistedMaterialId
            ? materials.findIndex((item) => item?._id?.toString?.() === persistedMaterialId)
            : -1;
        if (existingIndex === -1) {
            materials.push(material);
        }
        else {
            materials[existingIndex] = material;
        }
        lesson.materials = materials;
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonMaterials(courseId, lessonId, userId);
    }
    async deleteLessonMaterial(courseId, lessonId, materialId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi dars materiallarini boshqarishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const materials = this.ensureLessonMaterials(lesson);
        const material = materials.find((item) => item?._id?.toString?.() === materialId);
        if (!material) {
            throw new common_1.NotFoundException('Material topilmadi');
        }
        await this.cleanupLessonMaterialAssets(material);
        lesson.materials = materials.filter((item) => item?._id?.toString?.() !== materialId);
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonMaterials(courseId, lessonId, userId);
    }
    async getLessonLinkedTests(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu dars testlarini ko'rish huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        const isOwner = course.createdBy.toString() === userId;
        return {
            items: this.normalizeLessonLinkedTests(lesson).map((item) => this.serializeLinkedTest(item, userId, isOwner)),
        };
    }
    async upsertLessonLinkedTest(courseId, lessonId, userId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi lesson testini boshqarishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const linkedTests = this.normalizeLessonLinkedTests(lesson);
        const existing = linkedTests.find((item) => item?._id?.toString?.() === dto.linkedTestId ||
            String(item?.id || '') === dto.linkedTestId) || null;
        if (!existing) {
            const premiumStatus = await this.getUserPremiumStatus(userId);
            const linkedTestLimit = (0, app_limits_1.getTierLimit)(app_limits_1.APP_LIMITS.lessonTestsPerLesson, premiumStatus);
            if (linkedTests.length >= linkedTestLimit) {
                throw new common_1.ForbiddenException(`Bu tarifda bitta dars uchun maksimal ${linkedTestLimit} ta test biriktirish mumkin`);
            }
        }
        const resolved = await this.resolveLessonLinkedTest(dto.url || existing?.url || '', userId);
        const nextLinkedTest = existing || {
            _id: new mongoose_2.Types.ObjectId(),
            progress: [],
        };
        nextLinkedTest.title = resolved.title;
        nextLinkedTest.url = resolved.url;
        nextLinkedTest.resourceType = resolved.resourceType;
        nextLinkedTest.resourceId = resolved.resourceId;
        nextLinkedTest.testId =
            resolved.resourceType === 'test' ? resolved.resourceId : '';
        nextLinkedTest.shareShortCode = resolved.shareShortCode;
        nextLinkedTest.minimumScore = Math.max(0, Math.min(100, Number(dto.minimumScore ?? existing?.minimumScore ?? 60)));
        nextLinkedTest.timeLimit = resolved.shareShortCode
            ? Math.max(0, Number(resolved.timeLimit || 0))
            : Math.max(0, Number(existing?.timeLimit ?? 0));
        nextLinkedTest.showResults = resolved.shareShortCode
            ? resolved.showResults !== false
            : existing?.showResults !== false;
        nextLinkedTest.requiredToUnlock =
            typeof dto.requiredToUnlock === 'boolean'
                ? dto.requiredToUnlock
                : existing?.requiredToUnlock !== false;
        const existingResourceType = existing?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
        const existingResourceId = existing?.resourceId || existing?.testId || '';
        const isSameTest = existingResourceType === resolved.resourceType &&
            existingResourceId === resolved.resourceId;
        nextLinkedTest.progress =
            isSameTest && Array.isArray(existing?.progress) ? existing.progress : [];
        nextLinkedTest.progress = nextLinkedTest.progress.map((item) => ({
            ...item,
            passed: Math.max(Number(item?.bestPercent || 0), Number(item?.percent || 0)) >= Number(nextLinkedTest.minimumScore || 0),
        }));
        if (!existing) {
            linkedTests.push(nextLinkedTest);
        }
        lesson.linkedTests = linkedTests;
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonLinkedTests(courseId, lessonId, userId);
    }
    async deleteLessonLinkedTest(courseId, lessonId, linkedTestId, userId) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== userId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi lesson testini o'chira oladi");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        lesson.linkedTests = this.normalizeLessonLinkedTests(lesson).filter((item) => item?._id?.toString?.() !== linkedTestId &&
            String(item?.id || '') !== linkedTestId);
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonLinkedTests(courseId, lessonId, userId);
    }
    async submitLessonLinkedTestAttempt(courseId, lessonId, linkedTestId, user, dto) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
            throw new common_1.ForbiddenException("Bu lesson testini ishlash huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        const linkedTest = this.normalizeLessonLinkedTests(lesson).find((item) => item?._id?.toString?.() === linkedTestId ||
            String(item?.id || '') === linkedTestId);
        if (!linkedTest) {
            throw new common_1.NotFoundException('Lesson testi topilmadi');
        }
        const resourceType = linkedTest?.resourceType === 'sentenceBuilder' ? 'sentenceBuilder' : 'test';
        const resourceId = linkedTest?.resourceId || linkedTest?.testId || '';
        let score = 0;
        let total = 0;
        let percent = 0;
        let rawResults = [];
        if (resourceType === 'sentenceBuilder') {
            const result = await this.arenaService.submitSentenceBuilderAttempt(resourceId, {
                answers: this.normalizeSentenceBuilderLessonAnswers(dto?.sentenceBuilderAnswers || []),
                requestUserId: user._id.toString(),
                requestUserName: user.nickname || user.username,
                shareShortCode: linkedTest?.shareShortCode || null,
            });
            score = Number(result?.score || 0);
            total = Number(result?.total || 0);
            percent = Number(result?.accuracy || 0);
            rawResults = Array.isArray(result?.items) ? result.items : [];
        }
        else {
            const answers = Array.isArray(dto?.answers)
                ? dto.answers.map((value) => Number(value))
                : [];
            const result = await this.arenaService.submitAnswers(resourceId, user._id.toString(), answers, undefined, { includeHiddenResults: true });
            score = Number(result?.score || 0);
            total = Number(result?.total || 0);
            percent = total ? Math.round((score / Math.max(total, 1)) * 100) : 0;
            rawResults = Array.isArray(result?.results) ? result.results : [];
        }
        const passed = percent >= Number(linkedTest.minimumScore || 0);
        const progressList = Array.isArray(linkedTest.progress) ? linkedTest.progress : [];
        const existingProgress = progressList.find((item) => item?.userId?.toString?.() === user._id.toString()) || null;
        if (existingProgress) {
            existingProgress.userName = user.nickname || user.username;
            existingProgress.userAvatar =
                user.avatar ||
                    (user.nickname || user.username || '').substring(0, 2).toUpperCase();
            existingProgress.score = score;
            existingProgress.total = total;
            existingProgress.percent = percent;
            existingProgress.bestPercent = Math.max(Number(existingProgress.bestPercent || 0), percent);
            existingProgress.passed = Boolean(existingProgress.passed || passed);
            existingProgress.attemptsCount = Number(existingProgress.attemptsCount || 0) + 1;
            existingProgress.completedAt = new Date();
        }
        else {
            progressList.push({
                userId: new mongoose_2.Types.ObjectId(user._id),
                userName: user.nickname || user.username,
                userAvatar: user.avatar ||
                    (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
                score,
                total,
                percent,
                bestPercent: percent,
                passed,
                attemptsCount: 1,
                completedAt: new Date(),
            });
        }
        linkedTest.progress = progressList;
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return {
            score,
            total,
            percent,
            passed,
            resourceType,
            minimumScore: Number(linkedTest.minimumScore || 0),
            showResults: linkedTest.showResults !== false,
            results: linkedTest.showResults !== false ? rawResults : [],
            linkedTest: this.serializeLinkedTest(linkedTest, user._id.toString(), course.createdBy.toString() === user._id.toString()),
            nextLessonUnlocked: this.getIncompleteRequiredTestsBeforeLesson(course, user._id.toString(), lessonIndex + 1).length === 0,
        };
    }
    async submitLessonHomework(courseId, lessonId, assignmentId, user, dto) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1)
            throw new common_1.NotFoundException('Dars topilmadi');
        if (!this.canAccessLesson(course, user._id.toString(), lessonIndex)) {
            throw new common_1.ForbiddenException("Bu darsga uyga vazifa topshirib bo'lmaydi");
        }
        const lesson = course.lessons[lessonIndex];
        const assignment = this.findHomeworkAssignment(lesson, assignmentId);
        if (!assignment || !assignment.enabled) {
            throw new common_1.ForbiddenException('Bu dars uchun uyga vazifa yoqilmagan');
        }
        (0, app_limits_1.assertMaxChars)('Uyga vazifa matni', dto.text, app_limits_1.APP_TEXT_LIMITS.homeworkAnswerChars);
        (0, app_limits_1.assertMaxChars)('Uyga vazifa havolasi', dto.link, app_limits_1.APP_TEXT_LIMITS.homeworkLinkChars);
        const text = String(dto.text || '').trim();
        const link = String(dto.link || '').trim();
        const rawFileUrl = String(dto.fileUrl || '').trim();
        const fileName = String(dto.fileName || '').trim();
        const fileSize = Number(dto.fileSize || 0);
        const streamType = dto.streamType === 'hls' ? 'hls' : 'direct';
        const streamAssets = Array.isArray(dto.streamAssets) ? dto.streamAssets : [];
        const hlsKeyAsset = String(dto.hlsKeyAsset || '').trim();
        const homeworkType = assignment?.type || 'text';
        const derivedHlsFileUrl = streamType === 'hls'
            ? streamAssets.find((asset) => String(asset).endsWith('.m3u8')) || ''
            : '';
        const fileUrl = rawFileUrl || derivedHlsFileUrl;
        const hasTypedPayload = homeworkType === 'text'
            ? Boolean(text || link)
            : Boolean(fileUrl || link || (streamType === 'hls' && streamAssets.length));
        if (!hasTypedPayload) {
            throw new common_1.ForbiddenException(homeworkType === 'text'
                ? "Uyga vazifa uchun matn yoki havola kiritish kerak"
                : "Uyga vazifa uchun fayl yoki havola kiritish kerak");
        }
        if (homeworkType !== 'text' && fileUrl) {
            try {
                this.assertHomeworkSubmissionFileIsAllowed(homeworkType, fileName, fileSize);
            }
            catch (error) {
                await this.cleanupHomeworkSubmissionAssets({
                    fileUrl,
                    fileName,
                    fileSize,
                    streamType,
                    streamAssets,
                    hlsKeyAsset,
                });
                throw error;
            }
        }
        const existingSubmission = this.getHomeworkSubmission(assignment, user._id.toString());
        if (existingSubmission && existingSubmission.status !== 'needs_revision') {
            throw new common_1.ForbiddenException('Uyga vazifa allaqachon topshirilgan');
        }
        if (existingSubmission) {
            const shouldCleanupPreviousAssets = (existingSubmission.fileUrl || existingSubmission.streamAssets?.length) &&
                (existingSubmission.fileUrl !== fileUrl ||
                    JSON.stringify(existingSubmission.streamAssets || []) !==
                        JSON.stringify(streamAssets) ||
                    existingSubmission.hlsKeyAsset !== hlsKeyAsset);
            if (shouldCleanupPreviousAssets) {
                await this.cleanupHomeworkSubmissionAssets(existingSubmission);
            }
            existingSubmission.text = text;
            existingSubmission.link = link;
            existingSubmission.fileUrl = fileUrl;
            existingSubmission.fileName = fileName;
            existingSubmission.fileSize = fileSize;
            existingSubmission.streamType = streamType;
            existingSubmission.streamAssets = streamAssets;
            existingSubmission.hlsKeyAsset = hlsKeyAsset;
            existingSubmission.status = 'submitted';
            existingSubmission.submittedAt = new Date();
            existingSubmission.reviewedAt = null;
            existingSubmission.feedback = '';
            existingSubmission.score = null;
        }
        else {
            assignment.submissions.push({
                userId: new mongoose_2.Types.ObjectId(user._id),
                userName: user.nickname || user.username,
                userAvatar: user.avatar ||
                    (user.nickname || user.username || '').substring(0, 2).toUpperCase(),
                text,
                link,
                fileUrl,
                fileName,
                fileSize,
                streamType,
                streamAssets,
                hlsKeyAsset,
                status: 'submitted',
                score: null,
                feedback: '',
                submittedAt: new Date(),
                reviewedAt: null,
            });
        }
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonHomework(courseId, lessonId, user._id.toString());
    }
    async reviewLessonHomework(courseId, lessonId, assignmentId, submissionUserId, adminId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi uyga vazifani tekshirishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const assignment = this.findHomeworkAssignment(lesson, assignmentId);
        if (!assignment || !assignment.enabled) {
            throw new common_1.ForbiddenException('Bu dars uchun uyga vazifa yoqilmagan');
        }
        const submission = this.getHomeworkSubmission(assignment, submissionUserId);
        if (!submission) {
            throw new common_1.NotFoundException('Topshiriq topilmadi');
        }
        if (dto.feedback !== undefined) {
            (0, app_limits_1.assertMaxChars)('Uyga vazifa feedback', dto.feedback, app_limits_1.APP_TEXT_LIMITS.lessonDescriptionChars);
            submission.feedback = dto.feedback || '';
        }
        if (dto.status !== undefined) {
            submission.status = ['submitted', 'reviewed', 'needs_revision'].includes(dto.status)
                ? dto.status
                : 'reviewed';
        }
        if (dto.score !== undefined) {
            submission.score =
                dto.score === null
                    ? null
                    : Math.max(0, Math.min(Number(assignment.maxScore || 100), Number(dto.score || 0)));
        }
        submission.reviewedAt = new Date();
        if (!dto.status) {
            submission.status = 'reviewed';
        }
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonHomework(courseId, lessonId, adminId);
    }
    async setLessonOralAssessment(courseId, lessonId, targetUserId, adminId, dto) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() !== adminId) {
            throw new common_1.ForbiddenException("Faqat kurs egasi og'zaki baholashni kiritishi mumkin");
        }
        const lesson = this.findLessonByIdentifier(course, lessonId);
        if (!lesson)
            throw new common_1.NotFoundException('Dars topilmadi');
        const member = (course.members || []).find((item) => item.userId.toString() === targetUserId && item.status === 'approved');
        if (!member) {
            throw new common_1.NotFoundException("Kurs a'zosi topilmadi");
        }
        if (dto.note !== undefined) {
            (0, app_limits_1.assertMaxChars)("Og'zaki baholash izohi", dto.note, app_limits_1.APP_TEXT_LIMITS.lessonDescriptionChars);
        }
        lesson.oralAssessments = Array.isArray(lesson.oralAssessments)
            ? lesson.oralAssessments
            : [];
        let assessment = this.getOralAssessment(lesson, targetUserId);
        if (!assessment) {
            assessment = {
                userId: member.userId,
                userName: member.name,
                userAvatar: member.avatar,
                score: null,
                note: '',
                updatedAt: null,
            };
            lesson.oralAssessments.push(assessment);
        }
        if (dto.score !== undefined) {
            assessment.score =
                dto.score === null
                    ? null
                    : Math.max(0, Math.min(100, Number(dto.score || 0)));
        }
        if (dto.note !== undefined) {
            assessment.note = dto.note || '';
        }
        assessment.updatedAt = new Date();
        await course.save();
        await this.syncCourseMirrorCollections(course.toObject());
        return this.getLessonGrading(courseId, lessonId, adminId);
    }
    async getLessonGrading(courseId, lessonId, userId) {
        const course = await this.findById(courseId);
        const lessonIndex = course.lessons.findIndex((lesson) => lesson._id.toString() === lessonId || lesson.urlSlug === lessonId);
        if (lessonIndex === -1) {
            throw new common_1.NotFoundException('Dars topilmadi');
        }
        if (!this.canAccessLesson(course, userId, lessonIndex)) {
            throw new common_1.ForbiddenException("Bu dars baholashini ko'rish huquqi yo'q");
        }
        const lesson = course.lessons[lessonIndex];
        const isOwner = course.createdBy.toString() === userId;
        const approvedMembers = (course.members || []).filter((member) => member.status === 'approved');
        const lessonRows = approvedMembers.map((member) => this.buildLessonGradeRow(lesson, member));
        const lessonSummary = {
            averageScore: lessonRows.length
                ? Math.round(lessonRows.reduce((sum, row) => sum + row.lessonScore, 0) /
                    lessonRows.length)
                : 0,
            excellentCount: lessonRows.filter((row) => row.performance === 'excellent')
                .length,
            completedHomeworkCount: lessonRows.filter((row) => row.homeworkSubmitted)
                .length,
            attendanceMarkedCount: lessonRows.filter((row) => row.attendanceStatus !== 'absent' || row.attendanceProgress > 0).length,
        };
        const overview = this.buildCourseOverview(course, approvedMembers);
        if (!isOwner) {
            const selfLesson = lessonRows.find((row) => row.userId?.toString() === userId) || {
                userId,
                attendanceStatus: 'absent',
                attendanceProgress: 0,
                attendanceScore: 0,
                homeworkEnabled: this.normalizeHomeworkAssignments(lesson).filter((assignment) => assignment?.enabled).length > 0,
                homeworkStatus: 'missing',
                homeworkSubmitted: false,
                homeworkScore: null,
                homeworkPercent: this.normalizeHomeworkAssignments(lesson).filter((assignment) => assignment?.enabled).length > 0
                    ? 0
                    : null,
                feedback: '',
                lessonScore: 0,
                performance: 'no_activity',
            };
            const selfOverall = overview.students.find((student) => student.userId?.toString() === userId) || {
                userId,
                averageScore: 0,
                performance: 'no_activity',
                attendanceRate: 0,
                presentCount: 0,
                lateCount: 0,
                absentCount: overview.totalLessons,
                homeworkCompleted: 0,
                reviewedHomework: 0,
                totalLessons: overview.totalLessons,
            };
            return {
                lesson: {
                    lessonId: lesson._id.toString(),
                    title: lesson.title,
                    summary: lessonSummary,
                    self: selfLesson,
                },
                overview: {
                    ...overview,
                    students: undefined,
                    self: selfOverall,
                },
            };
        }
        return {
            lesson: {
                lessonId: lesson._id.toString(),
                title: lesson.title,
                summary: lessonSummary,
                students: lessonRows,
            },
            overview,
        };
    }
    async enroll(courseId, user) {
        const course = await this.findById(courseId);
        if (course.createdBy.toString() === user._id) {
            throw new common_1.ForbiddenException("Kurs egasi o'z kursiga obuna bo'la olmaydi");
        }
        course.members = course.members.filter((m) => m.userId.toString() !== course.createdBy.toString());
        const alreadyMember = course.members.find((m) => m.userId.toString() === user._id);
        if (alreadyMember)
            return course;
        const status = course.accessType === 'free_open' ? 'approved' : 'pending';
        course.members.push({
            userId: new mongoose_2.Types.ObjectId(user._id),
            name: user.nickname || user.username,
            avatar: (user.nickname || user.username).substring(0, 2).toUpperCase(),
            status,
            joinedAt: new Date(),
        });
        const updatedCourse = await course.save();
        await this.syncCourseMirrorCollections(updatedCourse.toObject());
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
        await this.syncCourseMirrorCollections(updatedCourse.toObject());
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
        await this.syncCourseMirrorCollections(updatedCourse.toObject());
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
        (0, app_limits_1.assertMaxChars)('Dars izohi', text, app_limits_1.APP_TEXT_LIMITS.messageChars);
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
        await this.syncCourseMirrorCollections(updatedCourse.toObject());
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
        (0, app_limits_1.assertMaxChars)('Dars javobi', text, app_limits_1.APP_TEXT_LIMITS.messageChars);
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
        await this.syncCourseMirrorCollections(updatedCourse.toObject());
        return this.sanitizeCourse(updatedCourse, user._id.toString());
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(course_schema_1.Course.name)),
    __param(1, (0, mongoose_1.InjectModel)(course_member_schema_1.CourseMemberRecord.name)),
    __param(2, (0, mongoose_1.InjectModel)(course_lesson_schema_1.CourseLessonRecord.name)),
    __param(3, (0, mongoose_1.InjectModel)(lesson_homework_schema_1.LessonHomeworkRecord.name)),
    __param(4, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        encryption_service_1.EncryptionService,
        r2_service_1.R2Service,
        courses_gateway_1.CoursesGateway,
        arena_service_1.ArenaService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map