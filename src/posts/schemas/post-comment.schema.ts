import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostCommentDocument = PostComment & Document;

@Schema({ timestamps: true })
export class PostComment {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PostComment', default: null, index: true })
  parentCommentId: Types.ObjectId | null;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  replyToUser: string;

  @Prop({ default: '' })
  iv: string;

  @Prop({ default: '' })
  authTag: string;

  @Prop({ default: false })
  isEncrypted: boolean;

  @Prop({ default: 0 })
  keyVersion: number;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);
PostCommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });
