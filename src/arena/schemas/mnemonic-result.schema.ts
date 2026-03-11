import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MnemonicResultDocument = MnemonicResult & Document;

@Schema({ timestamps: true })
export class MnemonicResult {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['digits', 'words'],
    required: true,
    index: true,
  })
  mode: 'digits' | 'words';

  @Prop({ required: true, min: 0 })
  score: number;

  @Prop({ required: true, min: 1 })
  total: number;

  @Prop({ required: true, min: 0 })
  elapsedMemorizeMs: number;

  @Prop({ required: true, min: 0, max: 100 })
  accuracy: number;
}

export const MnemonicResultSchema =
  SchemaFactory.createForClass(MnemonicResult);

MnemonicResultSchema.index({ userId: 1, mode: 1 }, { unique: true });
MnemonicResultSchema.index({ mode: 1, score: -1, elapsedMemorizeMs: 1 });
