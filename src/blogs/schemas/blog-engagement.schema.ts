import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlogEngagementDocument = BlogEngagement & Document;

@Schema({ timestamps: true })
export class BlogEngagement {
  @Prop({ type: Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  liked: boolean;

  @Prop({ default: false })
  viewed: boolean;
}

export const BlogEngagementSchema =
  SchemaFactory.createForClass(BlogEngagement);
BlogEngagementSchema.index({ blogId: 1, userId: 1 }, { unique: true });
BlogEngagementSchema.index({ userId: 1, liked: 1, updatedAt: -1 });
