import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseLessonRecordDocument = CourseLessonRecord & Document;

@Schema({ timestamps: true })
export class CourseLessonRecord {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  lessonId: Types.ObjectId;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: 'video' })
  type: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  urlSlug: string;

  @Prop({ enum: ['draft', 'published'], default: 'published' })
  status: string;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ default: 0 })
  order: number;

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

  @Prop({ type: Date, default: null })
  addedAt: Date | null;

  @Prop({ default: 0 })
  views: number;

  @Prop({ type: [Types.ObjectId], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [Object], default: [] })
  comments: Record<string, any>[];

  @Prop({ type: [Object], default: [] })
  attendance: Record<string, any>[];

  @Prop({ type: [Object], default: [] })
  oralAssessments: Record<string, any>[];

  @Prop({ type: Object, default: {} })
  content: Record<string, any>;

  @Prop({ default: '' })
  notionUrl: string;

  @Prop({ type: [Object], default: [] })
  mediaItems: Record<string, any>[];

  @Prop({ type: [Object], default: [] })
  materials: Record<string, any>[];

  @Prop({ type: [Object], default: [] })
  linkedTests: Record<string, any>[];
}

export const CourseLessonRecordSchema =
  SchemaFactory.createForClass(CourseLessonRecord);

CourseLessonRecordSchema.index({ courseId: 1, lessonId: 1 }, { unique: true });
