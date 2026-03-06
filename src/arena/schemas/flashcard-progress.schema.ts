import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FlashcardProgressDocument = FlashcardProgress & Document;

@Schema({ timestamps: true })
export class FlashcardProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'FlashcardDeck', required: true })
  deckId: Types.ObjectId;

  @Prop({ required: true })
  cardId: string; // The _id of the Flashcard within the deck

  // SM-2 Spaced Repetition Algorithm Data
  @Prop({ default: 2.5 })
  easeFactor: number;

  @Prop({ default: 0 })
  interval: number; // in days

  @Prop({ default: 0 })
  repetitions: number;

  @Prop({ default: () => new Date() })
  nextReviewDate: Date;
}

export const FlashcardProgressSchema =
  SchemaFactory.createForClass(FlashcardProgress);

// Compound index for efficient lookup
FlashcardProgressSchema.index(
  { userId: 1, deckId: 1, cardId: 1 },
  { unique: true },
);
