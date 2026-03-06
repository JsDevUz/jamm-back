import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BattleHistoryDocument = BattleHistory & Document;

@Schema({ timestamps: true })
export class BattleHistory {
  @Prop({ required: true })
  roomId: string;

  @Prop({ type: Types.ObjectId, ref: 'Test', required: true })
  testId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ required: true, default: 'solo' })
  mode: string;

  @Prop({
    type: [
      {
        userId: String,
        nickname: String,
        score: Number,
      },
    ],
    default: [],
  })
  participants: {
    userId: string;
    nickname: string;
    score: number;
  }[];
}

export const BattleHistorySchema = SchemaFactory.createForClass(BattleHistory);
