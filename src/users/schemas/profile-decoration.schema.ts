import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProfileDecorationDocument = ProfileDecoration & Document;

@Schema({ timestamps: true, collection: 'profile_decorations' })
export class ProfileDecoration {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, trim: true })
  emoji: string;

  @Prop({
    required: true,
    enum: ['pulse', 'float', 'wiggle', 'spin', 'sparkle'],
  })
  animation: string;

  @Prop({ default: true })
  premiumOnly: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;
}

export const ProfileDecorationSchema =
  SchemaFactory.createForClass(ProfileDecoration);

ProfileDecorationSchema.index({ isActive: 1, sortOrder: 1 });
