import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostEngagementDocument = PostEngagement & Document;

@Schema({ timestamps: true })
export class PostEngagement {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  liked: boolean;

  @Prop({ default: false })
  viewed: boolean;
}

export const PostEngagementSchema =
  SchemaFactory.createForClass(PostEngagement);
PostEngagementSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostEngagementSchema.index({ userId: 1, liked: 1, updatedAt: -1 });
