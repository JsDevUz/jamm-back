import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: true, timestamps: false })
export class Flashcard {
  @Prop({ required: true })
  front: string;

  @Prop({ required: false })
  frontImage?: string;

  @Prop({ required: true })
  back: string;

  @Prop({ required: false })
  backImage?: string;
}
export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);

export type FlashcardDeckDocument = FlashcardDeck & Document;

@Schema({ timestamps: true })
export class FlashcardDeck {
  @Prop({ unique: true, sparse: true })
  urlSlug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'FlashcardFolder', required: false, default: null })
  folderId?: Types.ObjectId | null;

  @Prop({ type: [FlashcardSchema], default: [] })
  cards: Flashcard[];

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

export const FlashcardDeckSchema = SchemaFactory.createForClass(FlashcardDeck);
