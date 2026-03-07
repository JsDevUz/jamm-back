import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppSettingDocument = AppSetting & Document;

@Schema({ timestamps: true })
export class AppSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ default: false })
  maintenanceMode: boolean;

  @Prop({ default: '' })
  maintenanceMessage: string;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);
