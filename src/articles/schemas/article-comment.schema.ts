import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ArticleCommentDocument = ArticleComment & Document;

@Schema({ timestamps: true, collection: 'article_comments' })
export class ArticleComment {
  @Prop({ type: Types.ObjectId, ref: 'Article', required: true, index: true })
  articleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ArticleComment', default: null, index: true })
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

export const ArticleCommentSchema = SchemaFactory.createForClass(ArticleComment);
ArticleCommentSchema.index({ articleId: 1, parentCommentId: 1, createdAt: -1 });
