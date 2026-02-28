import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PromoCodeDocument = PromoCode & Document;

@Schema({ timestamps: true })
export class PromoCode {
  @Prop({ required: true, unique: true })
  code: string; // This will store the hashed promo code

  @Prop({ required: true })
  validFrom: Date;

  @Prop({ required: true })
  validUntil: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  usedCount: number;

  @Prop({ default: null })
  maxUses: number;
}

export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);
