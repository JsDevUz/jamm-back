import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoRecordingDocument = VideoRecording & Document;

class VideoRecordingSegment {
  index: number;
  key: string;
  bytes: number;
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class VideoRecording {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerUserId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['whiteboard', 'meet'],
    required: true,
    index: true,
  })
  kind: 'whiteboard' | 'meet';

  @Prop({ required: true, trim: true, index: true })
  roomId: string;

  @Prop({ required: true, unique: true, index: true })
  publicId: string;

  @Prop({ required: true })
  accessToken: string;

  @Prop({
    type: String,
    enum: ['recording', 'finalizing', 'ready', 'failed', 'expired'],
    default: 'recording',
    index: true,
  })
  status: 'recording' | 'finalizing' | 'ready' | 'failed' | 'expired';

  @Prop({ default: 'video/webm' })
  mimeType: string;

  @Prop({ default: 'webm' })
  fileExtension: string;

  @Prop({ required: true, trim: true })
  filename: string;

  @Prop({ default: '' })
  apiBaseUrl: string;

  @Prop({ default: '' })
  appBaseUrl: string;

  @Prop({ default: '' })
  finalFileKey: string;

  @Prop({ default: '' })
  finalFileUrl: string;

  @Prop({
    type: [
      {
        index: { type: Number, required: true },
        key: { type: String, required: true },
        bytes: { type: Number, required: true, default: 0 },
        uploadedAt: { type: Date, required: true, default: Date.now },
      },
    ],
    default: [],
  })
  segments: VideoRecordingSegment[];

  @Prop({ default: 0 })
  bytesUploaded: number;

  @Prop({ default: 0 })
  durationMs: number;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date, default: Date.now, index: true })
  lastChunkAt: Date;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Chat', default: null })
  savedMessagesChatId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  savedMessageId: Types.ObjectId | null;

  @Prop({ default: '' })
  lastError: string;
}

export const VideoRecordingSchema =
  SchemaFactory.createForClass(VideoRecording);
