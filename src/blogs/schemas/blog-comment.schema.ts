import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlogCommentDocument = BlogComment & Document;

@Schema({ timestamps: true })
export class BlogComment {
  @Prop({ type: Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BlogComment', default: null, index: true })
  parentCommentId: Types.ObjectId | null;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  replyToUser: string;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogCommentSchema = SchemaFactory.createForClass(BlogComment);
BlogCommentSchema.index({ blogId: 1, parentCommentId: 1, createdAt: -1 });
