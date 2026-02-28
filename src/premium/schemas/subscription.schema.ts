import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'PremiumPlan',
    required: false,
    default: null,
  })
  planId?: Types.ObjectId;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: null })
  paymentId: string;

  @Prop({ default: 'promo' })
  paymentProvider: string;

  @Prop({
    type: String,
    enum: ['pending', 'active', 'cancelled', 'expired'],
    default: 'active',
  })
  status: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
