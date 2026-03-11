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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseSchema = exports.Course = exports.CourseMemberSchema = exports.CourseMember = exports.LessonSchema = exports.Lesson = exports.LessonMaterialSchema = exports.LessonMaterial = exports.LessonMediaItemSchema = exports.LessonMediaItem = exports.LessonTestLinkSchema = exports.LessonTestLink = exports.LessonTestProgressSchema = exports.LessonTestProgress = exports.OralAssessmentSchema = exports.OralAssessment = exports.HomeworkAssignmentSchema = exports.HomeworkAssignment = exports.HomeworkSubmissionSchema = exports.HomeworkSubmission = exports.AttendanceRecordSchema = exports.AttendanceRecord = exports.CommentSchema = exports.Comment = exports.ReplySchema = exports.Reply = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const generate_short_slug_1 = require("../../common/utils/generate-short-slug");
let Reply = class Reply {
    userId;
    userName;
    userAvatar;
    text;
    iv;
    authTag;
    encryptionType;
    isEncrypted;
    keyVersion;
    searchableText;
    createdAt;
};
exports.Reply = Reply;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Reply.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Reply.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Reply.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Reply.prototype, "text", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Reply.prototype, "iv", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Reply.prototype, "authTag", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'server' }),
    __metadata("design:type", String)
], Reply.prototype, "encryptionType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Reply.prototype, "isEncrypted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Reply.prototype, "keyVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Reply.prototype, "searchableText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Reply.prototype, "createdAt", void 0);
exports.Reply = Reply = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], Reply);
exports.ReplySchema = mongoose_1.SchemaFactory.createForClass(Reply);
let Comment = class Comment {
    userId;
    userName;
    userAvatar;
    text;
    iv;
    authTag;
    encryptionType;
    isEncrypted;
    keyVersion;
    searchableText;
    createdAt;
    replies;
};
exports.Comment = Comment;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Comment.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Comment.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Comment.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Comment.prototype, "text", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Comment.prototype, "iv", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Comment.prototype, "authTag", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'server' }),
    __metadata("design:type", String)
], Comment.prototype, "encryptionType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Comment.prototype, "isEncrypted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Comment.prototype, "keyVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Comment.prototype, "searchableText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Comment.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.ReplySchema], default: [] }),
    __metadata("design:type", Array)
], Comment.prototype, "replies", void 0);
exports.Comment = Comment = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], Comment);
exports.CommentSchema = mongoose_1.SchemaFactory.createForClass(Comment);
let AttendanceRecord = class AttendanceRecord {
    userId;
    userName;
    userAvatar;
    status;
    progressPercent;
    source;
    markedAt;
};
exports.AttendanceRecord = AttendanceRecord;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AttendanceRecord.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AttendanceRecord.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], AttendanceRecord.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['present', 'late', 'absent'], default: 'present' }),
    __metadata("design:type", String)
], AttendanceRecord.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AttendanceRecord.prototype, "progressPercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['auto', 'manual'], default: 'auto' }),
    __metadata("design:type", String)
], AttendanceRecord.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: () => new Date() }),
    __metadata("design:type", Date)
], AttendanceRecord.prototype, "markedAt", void 0);
exports.AttendanceRecord = AttendanceRecord = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], AttendanceRecord);
exports.AttendanceRecordSchema = mongoose_1.SchemaFactory.createForClass(AttendanceRecord);
let HomeworkSubmission = class HomeworkSubmission {
    userId;
    userName;
    userAvatar;
    text;
    link;
    fileUrl;
    fileName;
    fileSize;
    streamType;
    streamAssets;
    hlsKeyAsset;
    status;
    score;
    feedback;
    submittedAt;
    reviewedAt;
};
exports.HomeworkSubmission = HomeworkSubmission;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], HomeworkSubmission.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "text", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "link", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "fileUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "fileName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], HomeworkSubmission.prototype, "fileSize", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'direct', enum: ['direct', 'hls'] }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "streamType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], HomeworkSubmission.prototype, "streamAssets", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "hlsKeyAsset", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['submitted', 'reviewed', 'needs_revision'], default: 'submitted' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], HomeworkSubmission.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkSubmission.prototype, "feedback", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: () => new Date() }),
    __metadata("design:type", Date)
], HomeworkSubmission.prototype, "submittedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], HomeworkSubmission.prototype, "reviewedAt", void 0);
exports.HomeworkSubmission = HomeworkSubmission = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], HomeworkSubmission);
exports.HomeworkSubmissionSchema = mongoose_1.SchemaFactory.createForClass(HomeworkSubmission);
let HomeworkAssignment = class HomeworkAssignment {
    _id;
    enabled;
    title;
    description;
    type;
    deadline;
    maxScore;
    submissions;
};
exports.HomeworkAssignment = HomeworkAssignment;
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], HomeworkAssignment.prototype, "enabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkAssignment.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], HomeworkAssignment.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'text', enum: ['text', 'audio', 'video', 'pdf', 'photo'] }),
    __metadata("design:type", String)
], HomeworkAssignment.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], HomeworkAssignment.prototype, "deadline", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 100 }),
    __metadata("design:type", Number)
], HomeworkAssignment.prototype, "maxScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.HomeworkSubmissionSchema], default: [] }),
    __metadata("design:type", Array)
], HomeworkAssignment.prototype, "submissions", void 0);
exports.HomeworkAssignment = HomeworkAssignment = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], HomeworkAssignment);
exports.HomeworkAssignmentSchema = mongoose_1.SchemaFactory.createForClass(HomeworkAssignment);
let OralAssessment = class OralAssessment {
    userId;
    userName;
    userAvatar;
    score;
    note;
    updatedAt;
};
exports.OralAssessment = OralAssessment;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], OralAssessment.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OralAssessment.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], OralAssessment.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], OralAssessment.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], OralAssessment.prototype, "note", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], OralAssessment.prototype, "updatedAt", void 0);
exports.OralAssessment = OralAssessment = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], OralAssessment);
exports.OralAssessmentSchema = mongoose_1.SchemaFactory.createForClass(OralAssessment);
let LessonTestProgress = class LessonTestProgress {
    userId;
    userName;
    userAvatar;
    score;
    total;
    percent;
    bestPercent;
    passed;
    attemptsCount;
    completedAt;
};
exports.LessonTestProgress = LessonTestProgress;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], LessonTestProgress.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], LessonTestProgress.prototype, "userName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestProgress.prototype, "userAvatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestProgress.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestProgress.prototype, "total", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestProgress.prototype, "percent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestProgress.prototype, "bestPercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], LessonTestProgress.prototype, "passed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestProgress.prototype, "attemptsCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], LessonTestProgress.prototype, "completedAt", void 0);
exports.LessonTestProgress = LessonTestProgress = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], LessonTestProgress);
exports.LessonTestProgressSchema = mongoose_1.SchemaFactory.createForClass(LessonTestProgress);
let LessonTestLink = class LessonTestLink {
    _id;
    title;
    url;
    testId;
    resourceType;
    resourceId;
    shareShortCode;
    minimumScore;
    timeLimit;
    showResults;
    requiredToUnlock;
    progress;
};
exports.LessonTestLink = LessonTestLink;
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "url", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "testId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'test', enum: ['test', 'sentenceBuilder'] }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "resourceType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "resourceId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonTestLink.prototype, "shareShortCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 60 }),
    __metadata("design:type", Number)
], LessonTestLink.prototype, "minimumScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonTestLink.prototype, "timeLimit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], LessonTestLink.prototype, "showResults", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], LessonTestLink.prototype, "requiredToUnlock", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LessonTestProgressSchema], default: [] }),
    __metadata("design:type", Array)
], LessonTestLink.prototype, "progress", void 0);
exports.LessonTestLink = LessonTestLink = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], LessonTestLink);
exports.LessonTestLinkSchema = mongoose_1.SchemaFactory.createForClass(LessonTestLink);
let LessonMediaItem = class LessonMediaItem {
    _id;
    title;
    videoUrl;
    fileUrl;
    fileName;
    fileSize;
    durationSeconds;
    streamType;
    streamAssets;
    hlsKeyAsset;
};
exports.LessonMediaItem = LessonMediaItem;
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "videoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "fileUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "fileName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonMediaItem.prototype, "fileSize", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonMediaItem.prototype, "durationSeconds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'direct', enum: ['direct', 'hls'] }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "streamType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], LessonMediaItem.prototype, "streamAssets", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMediaItem.prototype, "hlsKeyAsset", void 0);
exports.LessonMediaItem = LessonMediaItem = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], LessonMediaItem);
exports.LessonMediaItemSchema = mongoose_1.SchemaFactory.createForClass(LessonMediaItem);
let LessonMaterial = class LessonMaterial {
    _id;
    title;
    fileUrl;
    fileName;
    fileSize;
};
exports.LessonMaterial = LessonMaterial;
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMaterial.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMaterial.prototype, "fileUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], LessonMaterial.prototype, "fileName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], LessonMaterial.prototype, "fileSize", void 0);
exports.LessonMaterial = LessonMaterial = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], LessonMaterial);
exports.LessonMaterialSchema = mongoose_1.SchemaFactory.createForClass(LessonMaterial);
let Lesson = class Lesson {
    _id;
    title;
    type;
    videoUrl;
    fileUrl;
    fileName;
    fileSize;
    durationSeconds;
    streamType;
    streamAssets;
    hlsKeyAsset;
    mediaItems;
    urlSlug;
    description;
    status;
    publishedAt;
    views;
    likes;
    addedAt;
    comments;
    attendance;
    homework;
    oralAssessments;
    linkedTests;
    materials;
};
exports.Lesson = Lesson;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Lesson.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'video', enum: ['video', 'file'] }),
    __metadata("design:type", String)
], Lesson.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "videoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "fileUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "fileName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Lesson.prototype, "fileSize", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Lesson.prototype, "durationSeconds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'direct', enum: ['direct', 'hls'] }),
    __metadata("design:type", String)
], Lesson.prototype, "streamType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "streamAssets", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "hlsKeyAsset", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LessonMediaItemSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "mediaItems", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => (0, generate_short_slug_1.generateShortSlug)(8) }),
    __metadata("design:type", String)
], Lesson.prototype, "urlSlug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['draft', 'published'], default: 'published' }),
    __metadata("design:type", String)
], Lesson.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Object)
], Lesson.prototype, "publishedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Lesson.prototype, "views", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], ref: 'User', default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "likes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Lesson.prototype, "addedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.CommentSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "comments", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.AttendanceRecordSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "attendance", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.HomeworkAssignmentSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "homework", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.OralAssessmentSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "oralAssessments", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LessonTestLinkSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "linkedTests", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LessonMaterialSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "materials", void 0);
exports.Lesson = Lesson = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], Lesson);
exports.LessonSchema = mongoose_1.SchemaFactory.createForClass(Lesson);
let CourseMember = class CourseMember {
    userId;
    name;
    avatar;
    status;
    joinedAt;
};
exports.CourseMember = CourseMember;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CourseMember.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CourseMember.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], CourseMember.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['pending', 'approved'], default: 'pending' }),
    __metadata("design:type", String)
], CourseMember.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], CourseMember.prototype, "joinedAt", void 0);
exports.CourseMember = CourseMember = __decorate([
    (0, mongoose_1.Schema)({ _id: true, timestamps: false })
], CourseMember);
exports.CourseMemberSchema = mongoose_1.SchemaFactory.createForClass(CourseMember);
let Course = class Course {
    name;
    description;
    image;
    gradient;
    category;
    urlSlug;
    accessType;
    price;
    rating;
    createdBy;
    members;
    lessons;
};
exports.Course = Course;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Course.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Course.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Course.prototype, "image", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Course.prototype, "gradient", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'IT' }),
    __metadata("design:type", String)
], Course.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        unique: true,
        default: () => (0, generate_short_slug_1.generateShortSlug)(8),
    }),
    __metadata("design:type", String)
], Course.prototype, "urlSlug", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['paid', 'free_request', 'free_open'],
        default: 'free_request',
    }),
    __metadata("design:type", String)
], Course.prototype, "accessType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Course.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Course.prototype, "rating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Course.prototype, "createdBy", void 0);
exports.Course = Course = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Course);
exports.CourseSchema = mongoose_1.SchemaFactory.createForClass(Course);
exports.CourseSchema.index({ createdBy: 1, createdAt: -1 });
exports.CourseSchema.index({ accessType: 1, createdAt: -1 });
exports.CourseSchema.index({ category: 1, createdAt: -1 });
//# sourceMappingURL=course.schema.js.map