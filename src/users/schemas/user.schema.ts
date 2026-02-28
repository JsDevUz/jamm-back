import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, trim: true })
  nickname: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ type: Date, default: null })
  lastSeen: Date;

  @Prop({ type: String, enum: ['none', 'active', 'expired'], default: 'none' })
  premiumStatus: string;

  @Prop({ type: Date, default: null })
  premiumExpiresAt: Date;

  @Prop({ default: false })
  hasUsedPromo: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
