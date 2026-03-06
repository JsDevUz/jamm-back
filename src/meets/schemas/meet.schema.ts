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
}

export const MeetSchema = SchemaFactory.createForClass(Meet);
