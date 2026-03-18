import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FlashcardFolderDocument = FlashcardFolder & Document;

@Schema({ timestamps: true })
export class FlashcardFolder {
  @Prop({ unique: true, sparse: true })
  urlSlug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  members: { userId: Types.ObjectId; joinedAt: Date }[];

  @Prop({ default: true })
  isPublic: boolean;
}

export const FlashcardFolderSchema =
  SchemaFactory.createForClass(FlashcardFolder);
