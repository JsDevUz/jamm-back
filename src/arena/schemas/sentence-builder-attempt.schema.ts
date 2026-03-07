import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false, timestamps: false })
export class SentenceBuilderAttemptItem {
  @Prop({ required: true })
  questionIndex: number;

  @Prop({ required: true })
  prompt: string;

  @Prop({ type: [String], default: [] })
  selectedTokens: string[];

  @Prop({ type: [String], default: [] })
  expectedTokens: string[];

  @Prop({ default: false })
  isCorrect: boolean;

  @Prop({
    type: [
      {
        _id: false,
        position: Number,
        actual: String,
        expected: String,
      },
    ],
    default: [],
  })
  mistakes: {
    position: number;
    actual: string | null;
    expected: string | null;
  }[];
}

export const SentenceBuilderAttemptItemSchema = SchemaFactory.createForClass(
  SentenceBuilderAttemptItem,
);

export type SentenceBuilderAttemptDocument = SentenceBuilderAttempt & Document;

@Schema({ timestamps: true })
export class SentenceBuilderAttempt {
  @Prop({ type: Types.ObjectId, ref: 'SentenceBuilderDeck', required: true, index: true })
  deckId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SentenceBuilderShareLink', default: null })
  shareLinkId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  participantUserId?: Types.ObjectId | null;

  @Prop({ required: true })
  participantName: string;

  @Prop({ default: '' })
  groupName: string;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  total: number;

  @Prop({ required: true })
  accuracy: number;

  @Prop({ type: [SentenceBuilderAttemptItemSchema], default: [] })
  items: SentenceBuilderAttemptItem[];

  createdAt?: Date;

  updatedAt?: Date;
}

export const SentenceBuilderAttemptSchema = SchemaFactory.createForClass(
  SentenceBuilderAttempt,
);
