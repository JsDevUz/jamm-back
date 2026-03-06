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

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  views: Types.ObjectId[];

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        content: String,
        iv: { type: String, default: '' },
        authTag: { type: String, default: '' },
        isEncrypted: { type: Boolean, default: false },
        keyVersion: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
        replies: [
          {
            userId: { type: Types.ObjectId, ref: 'User' },
            content: String,
            replyToUser: String,
            iv: { type: String, default: '' },
            authTag: { type: String, default: '' },
            isEncrypted: { type: Boolean, default: false },
            keyVersion: { type: Number, default: 0 },
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
    iv: string;
    authTag: string;
    isEncrypted: boolean;
    keyVersion: number;
    createdAt: Date;
    replies?: {
      _id?: Types.ObjectId;
      userId: Types.ObjectId;
      content: string;
      replyToUser: string;
      iv: string;
      authTag: string;
      isEncrypted: boolean;
      keyVersion: number;
      createdAt: Date;
    }[];
  }[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
