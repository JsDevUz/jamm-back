import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { generateShortSlug } from '../../common/utils/generate-short-slug';
import { generatePrefixedShortSlug } from '../../common/utils/prefixed-slug';

/* ---- Embedded sub-schemas ---- */

@Schema({ _id: true, timestamps: false })
export class Reply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: '' })
  iv: string;

  @Prop({ default: '' })
  authTag: string;

  @Prop({ default: 'server' })
  encryptionType: string;

  @Prop({ default: false })
  isEncrypted: boolean;

  @Prop({ default: 0 })
  keyVersion: number;

  @Prop({ default: '' })
  searchableText: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export const ReplySchema = SchemaFactory.createForClass(Reply);

@Schema({ _id: true, timestamps: false })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: '' })
  iv: string;

  @Prop({ default: '' })
  authTag: string;

  @Prop({ default: 'server' })
  encryptionType: string;

  @Prop({ default: false })
  isEncrypted: boolean;

  @Prop({ default: 0 })
  keyVersion: number;

  @Prop({ default: '' })
  searchableText: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ type: [ReplySchema], default: [] })
  replies: Reply[];
}
export const CommentSchema = SchemaFactory.createForClass(Comment);

@Schema({ _id: true, timestamps: false })
export class AttendanceRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ enum: ['present', 'late', 'absent'], default: 'present' })
  status: string;

  @Prop({ default: 0 })
  progressPercent: number;

  @Prop({ enum: ['auto', 'manual'], default: 'auto' })
  source: string;

  @Prop({ type: Date, default: () => new Date() })
  markedAt: Date;
}
export const AttendanceRecordSchema =
  SchemaFactory.createForClass(AttendanceRecord);

@Schema({ _id: true, timestamps: false })
export class HomeworkSubmission {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ default: '' })
  text: string;

  @Prop({ default: '' })
  link: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: 0 })
  fileSize: number;

  @Prop({ default: 'direct', enum: ['direct', 'hls'] })
  streamType: string;

  @Prop({ type: [String], default: [] })
  streamAssets: string[];

  @Prop({ default: '' })
  hlsKeyAsset: string;

  @Prop({ enum: ['submitted', 'reviewed', 'needs_revision'], default: 'submitted' })
  status: string;

  @Prop({ type: Number, default: null })
  score: number | null;

  @Prop({ default: '' })
  feedback: string;

  @Prop({ type: Date, default: () => new Date() })
  submittedAt: Date;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;
}
export const HomeworkSubmissionSchema =
  SchemaFactory.createForClass(HomeworkSubmission);

@Schema({ _id: true, timestamps: false })
export class HomeworkAssignment {
  _id: Types.ObjectId;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'text', enum: ['text', 'audio', 'video', 'pdf', 'photo'] })
  type: string;

  @Prop({ type: Date, default: null })
  deadline: Date | null;

  @Prop({ default: 100 })
  maxScore: number;

  @Prop({ type: [HomeworkSubmissionSchema], default: [] })
  submissions: HomeworkSubmission[];
}
export const HomeworkAssignmentSchema =
  SchemaFactory.createForClass(HomeworkAssignment);

@Schema({ _id: true, timestamps: false })
export class OralAssessment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ type: Number, default: null })
  score: number | null;

  @Prop({ default: '' })
  note: string;

  @Prop({ type: Date, default: null })
  updatedAt: Date | null;
}
export const OralAssessmentSchema =
  SchemaFactory.createForClass(OralAssessment);

@Schema({ _id: true, timestamps: false })
export class LessonTestProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  percent: number;

  @Prop({ default: 0 })
  bestPercent: number;

  @Prop({ default: false })
  passed: boolean;

  @Prop({ default: 0 })
  attemptsCount: number;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}
export const LessonTestProgressSchema =
  SchemaFactory.createForClass(LessonTestProgress);

@Schema({ _id: true, timestamps: false })
export class LessonTestLink {
  _id: Types.ObjectId;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  url: string;

  @Prop({ default: '' })
  testId: string;

  @Prop({ default: 'test', enum: ['test', 'sentenceBuilder'] })
  resourceType: string;

  @Prop({ default: '' })
  resourceId: string;

  @Prop({ default: '' })
  shareShortCode: string;

  @Prop({ default: 60 })
  minimumScore: number;

  @Prop({ default: 0 })
  timeLimit: number;

  @Prop({ default: true })
  showResults: boolean;

  @Prop({ default: true })
  requiredToUnlock: boolean;

  @Prop({ type: [LessonTestProgressSchema], default: [] })
  progress: LessonTestProgress[];
}
export const LessonTestLinkSchema =
  SchemaFactory.createForClass(LessonTestLink);

@Schema({ _id: true, timestamps: false })
export class LessonMediaItem {
  _id: Types.ObjectId;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  videoUrl: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: 0 })
  fileSize: number;

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop({ default: 'direct', enum: ['direct', 'hls'] })
  streamType: string;

  @Prop({ type: [String], default: [] })
  streamAssets: string[];

  @Prop({ default: '' })
  hlsKeyAsset: string;
}
export const LessonMediaItemSchema =
  SchemaFactory.createForClass(LessonMediaItem);

@Schema({ _id: true, timestamps: false })
export class LessonMaterial {
  _id: Types.ObjectId;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: 0 })
  fileSize: number;
}
export const LessonMaterialSchema =
  SchemaFactory.createForClass(LessonMaterial);

@Schema({ _id: true, timestamps: false })
export class Lesson {
  _id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'video', enum: ['video', 'file'] })
  type: string;

  @Prop({ default: '' })
  videoUrl: string;

  @Prop({ default: '' })
  fileUrl: string;

  @Prop({ default: '' })
  fileName: string;

  @Prop({ default: 0 })
  fileSize: number;

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop({ default: 'direct', enum: ['direct', 'hls'] })
  streamType: string;

  @Prop({ type: [String], default: [] })
  streamAssets: string[];

  @Prop({ default: '' })
  hlsKeyAsset: string;

  @Prop({ type: [LessonMediaItemSchema], default: [] })
  mediaItems: LessonMediaItem[];

  @Prop({ default: () => generateShortSlug(8) })
  urlSlug: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ enum: ['draft', 'published'], default: 'published' })
  status: string;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ default: 0 })
  views: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likes: Types.ObjectId[];

  @Prop({ default: () => new Date() })
  addedAt: Date;

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop({ type: [AttendanceRecordSchema], default: [] })
  attendance: AttendanceRecord[];

  @Prop({ type: [HomeworkAssignmentSchema], default: [] })
  homework: HomeworkAssignment[];

  @Prop({ type: [OralAssessmentSchema], default: [] })
  oralAssessments: OralAssessment[];

  @Prop({ type: [LessonTestLinkSchema], default: [] })
  linkedTests: LessonTestLink[];

  @Prop({ type: [LessonMaterialSchema], default: [] })
  materials: LessonMaterial[];
}
export const LessonSchema = SchemaFactory.createForClass(Lesson);

@Schema({ _id: true, timestamps: false })
export class CourseMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ enum: ['pending', 'approved'], default: 'pending' })
  status: string;

  @Prop({ default: () => new Date() })
  joinedAt: Date;
}
export const CourseMemberSchema = SchemaFactory.createForClass(CourseMember);

/* ---- Main Course schema ---- */

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ default: '' })
  gradient: string;

  @Prop({ default: 'IT' })
  category: string;

  @Prop({
    required: true,
    unique: true,
    default: () => generatePrefixedShortSlug('+', 8),
  })
  urlSlug: string;

  @Prop({
    enum: ['paid', 'free_request', 'free_open'],
    default: 'free_request',
  })
  accessType: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  // Runtime-only hydrated fields. Persisted in separate normalized collections.
  members: CourseMember[];
  lessons: Lesson[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ createdBy: 1, createdAt: -1 });
CourseSchema.index({ accessType: 1, createdAt: -1 });
CourseSchema.index({ category: 1, createdAt: -1 });
