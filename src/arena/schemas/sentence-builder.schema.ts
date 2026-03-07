import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: true, timestamps: false })
export class SentenceBuilderQuestion {
  @Prop({ required: true, trim: true })
  prompt: string;

  @Prop({ required: true, trim: true })
  answer: string;

  @Prop({ type: [String], default: [] })
  answerTokens: string[];

  @Prop({ type: [String], default: [] })
  extraTokens: string[];
}

export const SentenceBuilderQuestionSchema = SchemaFactory.createForClass(
  SentenceBuilderQuestion,
);

export type SentenceBuilderDeckDocument = SentenceBuilderDeck & Document;

@Schema({ timestamps: true })
export class SentenceBuilderDeck {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [SentenceBuilderQuestionSchema], default: [] })
  items: SentenceBuilderQuestion[];

  @Prop({ default: true })
  isPublic: boolean;
}

export const SentenceBuilderDeckSchema =
  SchemaFactory.createForClass(SentenceBuilderDeck);
