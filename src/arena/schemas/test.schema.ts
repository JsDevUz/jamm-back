import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: true, timestamps: false })
export class Question {
  @Prop({ required: true })
  questionText: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  correctOptionIndex: number;
}
export const QuestionSchema = SchemaFactory.createForClass(Question);

export type TestDocument = Test & Document;

@Schema({ timestamps: true })
export class Test {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: 'single', enum: ['single', 'list'] })
  displayMode: string; // 'single' for one-by-one, 'list' for all at once
}

export const TestSchema = SchemaFactory.createForClass(Test);
