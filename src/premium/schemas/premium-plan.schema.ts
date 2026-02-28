import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PremiumPlanDocument = PremiumPlan & Document;

@Schema({ timestamps: true })
export class PremiumPlan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  durationInDays: number;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const PremiumPlanSchema = SchemaFactory.createForClass(PremiumPlan);
