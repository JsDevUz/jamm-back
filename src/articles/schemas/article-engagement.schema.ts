import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ArticleEngagementDocument = ArticleEngagement & Document;

@Schema({ timestamps: true, collection: 'article_engagements' })
export class ArticleEngagement {
  @Prop({ type: Types.ObjectId, ref: 'Article', required: true, index: true })
  articleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  liked: boolean;

  @Prop({ default: false })
  viewed: boolean;
}

export const ArticleEngagementSchema =
  SchemaFactory.createForClass(ArticleEngagement);
ArticleEngagementSchema.index({ articleId: 1, userId: 1 }, { unique: true });
ArticleEngagementSchema.index({ userId: 1, liked: 1, updatedAt: -1 });
