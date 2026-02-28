import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
export class Lesson {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  videoUrl: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: () => new Date() })
  addedAt: Date;

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];
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

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [CourseMemberSchema], default: [] })
  members: CourseMember[];

  @Prop({ type: [LessonSchema], default: [] })
  lessons: Lesson[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
