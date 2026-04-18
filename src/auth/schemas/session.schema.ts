import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // Unique token ID stored in JWT payload to identify this session
  @Prop({ required: true, unique: true })
  tokenId: string;

  @Prop({ type: String, default: 'unknown' })
  deviceType: string; // 'mobile' | 'desktop' | 'tablet' | 'unknown'

  @Prop({ type: String, default: null })
  deviceName: string | null; // e.g. "Chrome on macOS"

  @Prop({ type: String, default: null })
  ipAddress: string | null;

  @Prop({ type: String, default: null })
  country: string | null;

  @Prop({ type: String, default: null })
  city: string | null;

  @Prop({ type: Date, default: Date.now })
  lastUsedAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// TTL index: auto-delete sessions older than 8 days (JWT expiry is 7 days)
SessionSchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: 8 * 24 * 60 * 60 });
