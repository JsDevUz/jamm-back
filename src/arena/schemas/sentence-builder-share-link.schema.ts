import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SentenceBuilderShareLinkDocument = SentenceBuilderShareLink & Document;

@Schema({ timestamps: true })
export class SentenceBuilderShareLink {
  @Prop({ type: Types.ObjectId, ref: 'SentenceBuilderDeck', required: true, index: true })
  deckId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  shortCode: string;

  @Prop({ default: '' })
  groupName: string;

  @Prop({ default: true })
  persistResults: boolean;

  @Prop({ default: true })
  showResults: boolean;

  @Prop({ default: 0 })
  timeLimit: number;

  createdAt?: Date;

  updatedAt?: Date;
}

export const SentenceBuilderShareLinkSchema = SchemaFactory.createForClass(
  SentenceBuilderShareLink,
);
