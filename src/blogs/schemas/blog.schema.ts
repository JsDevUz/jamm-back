import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlogDocument = Blog & Document;

@Schema({ timestamps: true })
export class Blog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true, unique: true })
  slug: string;

  @Prop({ default: '' })
  excerpt: string;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ required: true })
  markdownUrl: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  views: Types.ObjectId[];

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        replies: [
          {
            userId: { type: Types.ObjectId, ref: 'User', required: true },
            content: { type: String, required: true },
            replyToUser: { type: String, default: '' },
            createdAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],
    default: [],
  })
  comments: {
    _id?: Types.ObjectId;
    userId: Types.ObjectId;
    content: string;
    createdAt: Date;
    replies?: {
      _id?: Types.ObjectId;
      userId: Types.ObjectId;
      content: string;
      replyToUser: string;
      createdAt: Date;
    }[];
  }[];

  @Prop({ type: Date, default: Date.now })
  publishedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
