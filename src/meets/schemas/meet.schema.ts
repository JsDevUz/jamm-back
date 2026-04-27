import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type MeetDocument = Meet & Document;

@Schema({ timestamps: true })
export class Meet {
  @Prop({ required: true, unique: true })
  roomId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: User | Types.ObjectId;

  // Optional binding to a course lesson. When set, the room is treated as the
  // live session for that lesson — joins/leaves drive automatic attendance and
  // the teacher gets in-meet attendance/grading controls.
  @Prop({ type: Types.ObjectId, ref: 'Course', default: null })
  courseId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  lessonId: string | null;
}

export const MeetSchema = SchemaFactory.createForClass(Meet);
