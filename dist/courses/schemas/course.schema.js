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
exports.CourseSchema = exports.Course = exports.CourseMemberSchema = exports.CourseMember = exports.LessonSchema = exports.Lesson = exports.CommentSchema = exports.Comment = exports.ReplySchema = exports.Reply = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
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
let Lesson = class Lesson {
    title;
    videoUrl;
    description;
    views;
    addedAt;
    comments;
};
exports.Lesson = Lesson;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Lesson.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Lesson.prototype, "videoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Lesson.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Lesson.prototype, "views", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], Lesson.prototype, "addedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.CommentSchema], default: [] }),
    __metadata("design:type", Array)
], Lesson.prototype, "comments", void 0);
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
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.CourseMemberSchema], default: [] }),
    __metadata("design:type", Array)
], Course.prototype, "members", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [exports.LessonSchema], default: [] }),
    __metadata("design:type", Array)
], Course.prototype, "lessons", void 0);
exports.Course = Course = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Course);
exports.CourseSchema = mongoose_1.SchemaFactory.createForClass(Course);
//# sourceMappingURL=course.schema.js.map