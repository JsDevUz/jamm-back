import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { generatePrefixedShortSlug } from '../../common/utils/prefixed-slug';

export type BlogDocument = Blog & Document;

@Schema({ timestamps: true })
export class Blog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    trim: true,
    unique: true,
    default: () => generatePrefixedShortSlug(':', 8),
  })
  slug: string;

  @Prop({ default: '' })
  excerpt: string;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ required: true })
  markdownUrl: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  likesCount: number;

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ default: 0 })
  commentsCount: number;

  @Prop({ type: Date, default: Date.now })
  publishedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
BlogSchema.index({ isDeleted: 1, publishedAt: -1, createdAt: -1 });
BlogSchema.index({ author: 1, isDeleted: 1, publishedAt: -1, createdAt: -1 });
BlogSchema.index({ isDeleted: 1, likesCount: -1, publishedAt: -1, createdAt: -1 });
