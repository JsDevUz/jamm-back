import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseMemberRecordDocument = CourseMemberRecord & Document;

@Schema({ timestamps: true })
export class CourseMemberRecord {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: '' })
  userName: string;

  @Prop({ default: '' })
  userAvatar: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;

  @Prop({ type: Date, default: null })
  requestedAt: Date | null;

  @Prop({ type: Date, default: null })
  joinedAt: Date | null;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const CourseMemberRecordSchema =
  SchemaFactory.createForClass(CourseMemberRecord);

CourseMemberRecordSchema.index({ courseId: 1, userId: 1 }, { unique: true });
