import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

// Sub-document for join requests
export class JoinRequest {
  _id: Types.ObjectId;
  name: string;
  userId?: string; // null for ghost users
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true, default: false })
  isGroup: boolean;

  @Prop({ default: false })
  isE2EEnabled: boolean;

  @Prop({ type: Number, unique: true, sparse: true })
  jammId?: number;

  @Prop({ unique: true, sparse: true })
  privateurl?: string;

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop()
  description?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  members: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        permissions: [String],
      },
    ],
    default: [],
  })
  admins: { userId: Types.ObjectId; permissions: string[] }[];

  @Prop()
  lastMessage?: string;

  @Prop()
  lastMessageIv?: string;

  @Prop()
  lastMessageAuthTag?: string;

  @Prop({ default: 'none' })
  lastMessageEncryptionType?: string;

  @Prop({ default: 0 })
  lastMessageKeyVersion: number;

  @Prop()
  lastMessageAt?: Date;

  // Video call fields
  @Prop()
  videoCallRoomId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  videoCallCreatorId?: Types.ObjectId;

  @Prop({
    type: [
      {
        name: String,
        userId: String,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  joinRequests: JoinRequest[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
