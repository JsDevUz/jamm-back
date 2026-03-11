import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppSettingDocument = AppSetting & Document;

@Schema({ _id: false })
export class OfficialProfileConfig {
  @Prop({ required: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true, trim: true })
  badgeKey: string;

  @Prop({ required: true, trim: true })
  badgeLabel: string;

  @Prop({ default: true })
  disableCalls: boolean;

  @Prop({ default: true })
  disableGroupInvites: boolean;

  @Prop({ default: true })
  hidePresence: boolean;
}

export const OfficialProfileConfigSchema =
  SchemaFactory.createForClass(OfficialProfileConfig);

@Schema({ timestamps: true })
export class AppSetting {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ default: false })
  maintenanceMode: boolean;

  @Prop({ default: '' })
  maintenanceMessage: string;

  @Prop({ type: [OfficialProfileConfigSchema], default: [] })
  officialProfiles: OfficialProfileConfig[];
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);
