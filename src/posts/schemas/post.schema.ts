import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  iv: string;

  @Prop({ default: '' })
  authTag: string;

  @Prop({ default: 'none' })
  encryptionType: string; // 'none' | 'server'

  @Prop({ default: false })
  isEncrypted: boolean;

  @Prop({ default: 0 })
  keyVersion: number;

  @Prop({ default: 0 })
  likesCount: number;

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ default: 0 })
  commentsCount: number;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ isDeleted: 1, createdAt: -1 });
PostSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, likesCount: -1, createdAt: -1 });
