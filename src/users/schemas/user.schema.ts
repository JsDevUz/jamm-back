import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  Types,
  CallbackWithoutResultAndOptionalError,
} from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: false,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  })
  username: string;

  @Prop({ required: true, trim: true })
  nickname: string;

  @Prop({ required: false, trim: true })
  phone: string;

  @Prop({
    type: String,
    enum: ['male', 'female', null],
    default: null,
  })
  gender: string;

  @Prop({ type: Number, default: null })
  age: number;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ type: Date, default: null })
  lastSeen: Date;

  @Prop({ type: String, enum: ['none', 'active', 'expired'], default: 'none' })
  premiumStatus: string;

  @Prop({ type: Date, default: null })
  premiumExpiresAt: Date;

  @Prop({ default: false })
  hasUsedPromo: boolean;

  @Prop({ default: '' })
  bio: string;

  @Prop({ type: String, default: null })
  selectedProfileDecorationId: string | null;

  @Prop({ type: String, default: null })
  customProfileDecorationImage: string | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followers: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  following: Types.ObjectId[];

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: String, default: null })
  verificationToken: string | null;

  @Prop({ type: String, default: null })
  passwordResetToken: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt: Date | null;

  // Short numeric ID used in profile URLs like /profile/142857
  @Prop({ unique: true, sparse: true })
  jammId: number;

  @Prop({ default: false })
  isOnboardingCompleted: boolean;

  @Prop({ type: Object, default: {} })
  onboardingData: Record<string, any>;

  @Prop({ type: String, default: null, select: false })
  appLockPinHash: string | null;

  @Prop({ default: false })
  appLockEnabled: boolean;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({
    type: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: null },
        deviceId: { type: String, default: null },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  pushTokens: Array<{
    token: string;
    platform?: string | null;
    deviceId?: string | null;
    updatedAt?: Date;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Auto-generate jammId (6-digit) before saving a new user
UserSchema.pre<UserDocument>('save', async function () {
  if (this.isNew && !(this as any).jammId) {
    const id = Math.floor(100000 + Math.random() * 900000);
    (this as any).jammId = id;
  }
});
