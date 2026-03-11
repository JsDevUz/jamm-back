import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonHomeworkRecordDocument = LessonHomeworkRecord & Document;

@Schema({ timestamps: true })
export class LessonHomeworkRecord {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  lessonId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  assignmentId: Types.ObjectId;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'text' })
  type: string;

  @Prop({ type: Date, default: null })
  deadline: Date | null;

  @Prop({ default: 100 })
  maxScore: number;

  @Prop({ type: [Object], default: [] })
  submissions: Record<string, any>[];
}

export const LessonHomeworkRecordSchema =
  SchemaFactory.createForClass(LessonHomeworkRecord);

LessonHomeworkRecordSchema.index(
  { courseId: 1, lessonId: 1, assignmentId: 1 },
  { unique: true },
);
