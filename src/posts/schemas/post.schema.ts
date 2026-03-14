import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ _id: false })
export class PostImage {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  blurDataUrl: string;

  @Prop({ type: Number, default: null })
  width?: number | null;

  @Prop({ type: Number, default: null })
  height?: number | null;
}

export const PostImageSchema = SchemaFactory.createForClass(PostImage);

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [PostImageSchema], default: [] })
  images: PostImage[];

  @Prop({ default: '' })
  iv: string;

  @Prop({ default: '' })
  authTag: string;

  @Prop({ default: 'none' })
  encryptionType: string;

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
