import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { Model, Types } from 'mongoose';
import { R2Service } from '../common/services/r2.service';
import { ChatsService } from '../chats/chats.service';
import {
  VideoRecording,
  VideoRecordingDocument,
} from './schemas/video-recording.schema';

const RECORDING_STALE_MS = 90_000;
const RECORDING_EXPIRES_MS = 24 * 60 * 60 * 1000;
const RECORDING_SEGMENT_WAIT_MS = 5_000;
const RECORDING_DOWNLOAD_WARNING_UZ =
  "24 soat ichida o'chirib tashlanadi.";
const RECORDING_MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const execFileAsync = promisify(execFile);

const normalizeBaseUrl = (value?: string | null) =>
  String(value || '').trim().replace(/\/+$/, '');

const sanitizeFilename = (value?: string | null, fallback = 'recording.webm') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
};

const detectFileExtension = (mimeType?: string, filename?: string) => {
  const name = String(filename || '').trim().toLowerCase();
  if (name.endsWith('.webm')) return 'webm';
  if (name.endsWith('.mp4')) return 'mp4';

  const type = String(mimeType || '').toLowerCase();
  if (type.includes('mp4')) return 'mp4';
  return 'webm';
};

const replaceFileExtension = (filename: string, nextExtension: string) => {
  const safeName = String(filename || '').trim() || `recording.${nextExtension}`;
  const extension = String(nextExtension || '').trim().replace(/^\.+/, '');
  if (!extension) {
    return safeName;
  }

  return safeName.replace(/\.[^.]+$/, '') + `.${extension}`;
};

@Injectable()
export class VideoRecordingsService {
  private readonly logger = new Logger(VideoRecordingsService.name);
  private readonly finalizationTasks = new Map<
    string,
    Promise<VideoRecordingDocument | null>
  >();
  private readonly mp4ConversionTasks = new Map<
    string,
    Promise<VideoRecordingDocument>
  >();

  constructor(
    @InjectModel(VideoRecording.name)
    private readonly recordingModel: Model<VideoRecordingDocument>,
    private readonly r2Service: R2Service,
    private readonly chatsService: ChatsService,
  ) {}

  async createSession(
    userId: string,
    input: {
      kind: 'whiteboard' | 'meet';
      roomId: string;
      mimeType?: string;
      filename?: string;
      apiBaseUrl?: string;
      appBaseUrl?: string;
    },
  ) {
    if (!['whiteboard', 'meet'].includes(String(input.kind))) {
      throw new BadRequestException("Noto'g'ri recording turi");
    }

    const roomId = String(input.roomId || '').trim();
    if (!roomId) {
      throw new BadRequestException('Room ID kerak');
    }

    const fileExtension = detectFileExtension(input.mimeType, input.filename);
    const safeFilename = sanitizeFilename(
      input.filename,
      `${input.kind}-${roomId}-${Date.now()}.${fileExtension}`,
    );
    const now = new Date();

    const session = await this.recordingModel.create({
      ownerUserId: new Types.ObjectId(userId),
      kind: input.kind,
      roomId,
      publicId: randomUUID(),
      accessToken: randomUUID(),
      status: 'recording',
      mimeType: input.mimeType || 'video/webm',
      fileExtension,
      filename: safeFilename,
      apiBaseUrl: normalizeBaseUrl(input.apiBaseUrl),
      appBaseUrl: normalizeBaseUrl(input.appBaseUrl),
      startedAt: now,
      lastChunkAt: now,
      bytesUploaded: 0,
      durationMs: 0,
      segments: [],
    });

    return {
      sessionId: session._id.toString(),
      kind: session.kind,
      filename: session.filename,
      status: session.status,
    };
  }

  async uploadChunk(
    sessionId: string,
    userId: string,
    input: {
      chunkIndex: number;
      file: Express.Multer.File;
    },
  ) {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException('Recording chunk topilmadi');
    }

    if (input.file.size > RECORDING_MAX_CHUNK_BYTES) {
      throw new BadRequestException('Recording chunk juda katta');
    }

    const chunkIndex = Number(input.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new BadRequestException("Chunk tartib raqami noto'g'ri");
    }

    const session = await this.requireOwnedSession(sessionId, userId);
    if (!['recording', 'finalizing'].includes(session.status)) {
      throw new BadRequestException('Recording sessiyasi yopilgan');
    }

    const existingSegment = (session.segments || []).find(
      (segment) => segment.index === chunkIndex,
    );
    if (existingSegment) {
      return {
        ok: true,
        duplicate: true,
        chunkIndex,
      };
    }

    const chunkKey = this.buildChunkKey(session, chunkIndex);
    await this.r2Service.uploadBuffer(
      input.file.buffer,
      chunkKey,
      input.file.mimetype || session.mimeType || 'video/webm',
    );

    const now = new Date();
    const updateResult = await this.recordingModel.updateOne(
      {
        _id: session._id,
        ownerUserId: session.ownerUserId,
        'segments.index': { $ne: chunkIndex },
      },
      {
        $push: {
          segments: {
            index: chunkIndex,
            key: chunkKey,
            bytes: input.file.size,
            uploadedAt: now,
          },
        },
        $inc: {
          bytesUploaded: input.file.size,
        },
        $set: {
          lastChunkAt: now,
          status: 'recording',
        },
      },
    );

    if (!updateResult.modifiedCount) {
      return {
        ok: true,
        duplicate: true,
        chunkIndex,
      };
    }

    const refreshedSession = await this.recordingModel
      .findById(session._id)
      .select('bytesUploaded')
      .exec();

    return {
      ok: true,
      chunkIndex,
      bytesUploaded: refreshedSession?.bytesUploaded || 0,
    };
  }

  async finishSession(
    sessionId: string,
    userId: string,
    input?: { durationMs?: number },
  ) {
    const session = await this.requireOwnedSession(sessionId, userId);
    if (Number.isFinite(input?.durationMs)) {
      session.durationMs = Math.max(0, Number(input?.durationMs) || 0);
      await session.save();
    }

    const finalized = await this.finalizeSession(session._id.toString());

    return {
      ok: Boolean(finalized && finalized.status === 'ready'),
      status: finalized?.status || 'failed',
      lastError: finalized?.lastError || '',
      uploadedBytes: finalized?.bytesUploaded || 0,
    };
  }

  async finalizeStaleSessions() {
    const staleBefore = new Date(Date.now() - RECORDING_STALE_MS);

    const staleSessions = await this.recordingModel
      .find({
        status: { $in: ['recording', 'finalizing'] },
        lastChunkAt: { $lt: staleBefore },
      })
      .sort({ lastChunkAt: 1 })
      .limit(10)
      .exec();

    for (const session of staleSessions) {
      try {
        await this.finalizeSession(session._id.toString());
      } catch (error) {
        this.logger.error(
          `Failed to finalize stale recording ${session._id}`,
          error as any,
        );
      }
    }
  }

  async cleanupExpiredRecordings() {
    const now = new Date();
    const expiredSessions = await this.recordingModel
      .find({
        expiresAt: { $ne: null, $lt: now },
        status: { $in: ['ready', 'failed', 'expired'] },
      })
      .limit(20)
      .exec();

    for (const session of expiredSessions) {
      try {
        await this.deleteRecordingAssets(session);
        session.status = 'expired';
        session.expiresAt = null;
        session.finalFileKey = '';
        session.finalFileUrl = '';
        session.segments = [];
        await session.save();
      } catch (error) {
        this.logger.error(
          `Failed to cleanup expired recording ${session._id}`,
          error as any,
        );
      }
    }
  }

  async getDownloadableRecording(publicId: string, token: string) {
    const session = await this.recordingModel
      .findOne({
        publicId,
        accessToken: token,
        status: { $ne: 'expired' },
      })
      .exec();

    if (!session?.finalFileKey) {
      throw new NotFoundException('Recording topilmadi');
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Recording muddati tugagan');
    }

    return session;
  }

  async ensureMp4DownloadableRecording(session: VideoRecordingDocument) {
    const normalizedExtension = String(session.fileExtension || '')
      .trim()
      .toLowerCase();
    const normalizedMimeType = String(session.mimeType || '')
      .trim()
      .toLowerCase();

    if (
      normalizedExtension === 'mp4' ||
      normalizedMimeType.includes('mp4') ||
      String(session.finalFileKey || '').toLowerCase().endsWith('.mp4')
    ) {
      return session;
    }

    const taskKey = session._id.toString();
    const existingTask = this.mp4ConversionTasks.get(taskKey);
    if (existingTask) {
      return existingTask;
    }

    const task = this.convertRecordingToMp4(session).finally(() => {
      this.mp4ConversionTasks.delete(taskKey);
    });
    this.mp4ConversionTasks.set(taskKey, task);
    return task;
  }

  async getRecordingFileStream(session: VideoRecordingDocument) {
    return this.r2Service.getFileStream(session.finalFileKey);
  }

  private async waitForSegments(
    sessionId: string,
    timeoutMs = RECORDING_SEGMENT_WAIT_MS,
  ) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const freshSession = await this.recordingModel.findById(sessionId).exec();
      if (freshSession?.segments?.length) {
        return freshSession;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return this.recordingModel.findById(sessionId).exec();
  }

  private async requireOwnedSession(sessionId: string, userId: string) {
    const session = await this.recordingModel
      .findById(sessionId)
      .exec();

    if (!session) {
      throw new NotFoundException('Recording sessiyasi topilmadi');
    }

    if (String(session.ownerUserId) !== String(userId)) {
      throw new ForbiddenException("Bu recording sizga tegishli emas");
    }

    return session;
  }

  private buildChunkKey(session: VideoRecordingDocument, chunkIndex: number) {
    const indexLabel = String(chunkIndex).padStart(8, '0');
    const extension = session.fileExtension || 'webm';
    return `recordings/raw/${session.ownerUserId.toString()}/${session._id.toString()}/chunks/${indexLabel}.${extension}`;
  }

  private buildFinalKey(session: VideoRecordingDocument) {
    return `recordings/final/${session.ownerUserId.toString()}/${session._id.toString()}/${session.filename}`;
  }

  private async convertLocalRecordingToMp4(
    inputPath: string,
    outputPath: string,
  ) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-fflags',
      '+genpts',
      '-avoid_negative_ts',
      'make_zero',
      '-i',
      inputPath,
      '-map',
      '0:v:0?',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }

  private async downloadObjectToLocalFile(key: string, outputPath: string) {
    const output = createWriteStream(outputPath, { flags: 'w' });

    try {
      const file = await this.r2Service.getFileStream(key);
      await this.appendStreamToFile(file.stream, output);

      await new Promise<void>((resolve, reject) => {
        output.end((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } finally {
      output.destroy();
    }
  }

  private async assembleRecordingChunksToFile(
    segmentKeys: string[],
    outputPath: string,
  ) {
    const output = createWriteStream(outputPath, { flags: 'w' });

    try {
      for (const segmentKey of segmentKeys) {
        const file = await this.r2Service.getFileStream(segmentKey);
        await this.appendStreamToFile(file.stream, output);
      }

      await new Promise<void>((resolve, reject) => {
        output.end((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } finally {
      output.destroy();
    }
  }

  private buildDownloadUrl(session: VideoRecordingDocument) {
    const apiBaseUrl = normalizeBaseUrl(session.apiBaseUrl);
    if (!apiBaseUrl) {
      return '';
    }

    const encodedToken = encodeURIComponent(session.accessToken);
    return `${apiBaseUrl}/video/recordings/download/${session.publicId}?token=${encodedToken}`;
  }

  private buildSavedMessageText(
    session: VideoRecordingDocument,
    downloadUrl: string,
  ) {
    const label =
      session.kind === 'meet' ? 'Meet yozuvi tayyor:' : 'Doska yozuvi tayyor:';

    return `${label}\n${downloadUrl}\n\n${RECORDING_DOWNLOAD_WARNING_UZ}`;
  }

  private async finalizeSession(sessionId: string) {
    const taskKey = String(sessionId);
    const existingTask = this.finalizationTasks.get(taskKey);
    if (existingTask) {
      return existingTask;
    }

    const task = this.finalizeSessionInternal(taskKey).finally(() => {
      this.finalizationTasks.delete(taskKey);
    });
    this.finalizationTasks.set(taskKey, task);
    return task;
  }

  private async finalizeSessionInternal(sessionId: string) {
    const session = await this.recordingModel.findById(sessionId).exec();
    if (!session) {
      return null;
    }

    if (session.status === 'expired') {
      return session;
    }

    if (session.status === 'ready' && session.savedMessageId) {
      return session;
    }

    session.status = 'finalizing';
    await session.save();

    try {
      if (!session.finalFileKey) {
        let workingSession = session;

        if (
          !Array.isArray(workingSession.segments) ||
          workingSession.segments.length === 0
        ) {
          const refreshedSession = await this.waitForSegments(
            workingSession._id.toString(),
          );
          if (refreshedSession) {
            workingSession = refreshedSession;
          }
        }

        if (
          !Array.isArray(workingSession.segments) ||
          workingSession.segments.length === 0
        ) {
          session.status = 'failed';
          session.lastError = 'Recording chunklari topilmadi';
          session.expiresAt = new Date(Date.now() + RECORDING_EXPIRES_MS);
          await session.save();
          return session;
        }

        const tempDir = join(
          tmpdir(),
          'jamm-recordings',
          workingSession._id.toString(),
        );
        await mkdir(tempDir, { recursive: true });
        const rawExtension = workingSession.fileExtension || 'webm';
        const assembledInputPath = join(tempDir, `assembled.${rawExtension}`);
        const convertedOutputPath = join(tempDir, 'final.mp4');

        try {
          const sortedSegments = [...(workingSession.segments || [])].sort(
            (left, right) => left.index - right.index,
          );
          await this.assembleRecordingChunksToFile(
            sortedSegments.map((segment) => segment.key),
            assembledInputPath,
          );

          if (rawExtension === 'mp4') {
            session.fileExtension = 'mp4';
            session.mimeType = 'video/mp4';
            session.filename = replaceFileExtension(session.filename, 'mp4');

            const finalFileKey = this.buildFinalKey(session);
            const finalFileUrl = await this.r2Service.uploadLocalFile(
              assembledInputPath,
              finalFileKey,
              'video/mp4',
            );

            session.finalFileKey = finalFileKey;
            session.finalFileUrl = finalFileUrl;
          } else {
            await this.convertLocalRecordingToMp4(
              assembledInputPath,
              convertedOutputPath,
            );

            session.fileExtension = 'mp4';
            session.mimeType = 'video/mp4';
            session.filename = replaceFileExtension(session.filename, 'mp4');

            const finalFileKey = this.buildFinalKey(session);
            const finalFileUrl = await this.r2Service.uploadLocalFile(
              convertedOutputPath,
              finalFileKey,
              'video/mp4',
            );

            session.finalFileKey = finalFileKey;
            session.finalFileUrl = finalFileUrl;
          }
        } finally {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }

      await Promise.all(
        (session.segments || []).map((segment) =>
          this.r2Service.deleteFile(segment.key),
        ),
      );

      session.status = 'ready';
      session.finishedAt = new Date();
      session.expiresAt = new Date(Date.now() + RECORDING_EXPIRES_MS);
      session.lastError = '';
      session.segments = [];
      await session.save();

      const downloadUrl = this.buildDownloadUrl(session);
      if (!downloadUrl) {
        throw new BadRequestException('Recording yuklab olish manzili topilmadi');
      }

      if (!session.savedMessageId) {
        try {
          const ownerUserId = session.ownerUserId.toString();
          const savedChat = await this.chatsService.ensureSavedMessagesChat(
            ownerUserId,
          );
          const message = await this.chatsService.sendMessage(
            savedChat._id.toString(),
            ownerUserId,
            this.buildSavedMessageText(session, downloadUrl),
          );

          session.savedMessagesChatId = savedChat._id as any;
          session.savedMessageId = message._id as any;
          await session.save();
        } catch (messageError) {
          this.logger.error(
            `Failed to send saved-messages recording link for ${session._id}`,
            messageError as any,
          );
        }
      }

      return session;
    } catch (error) {
      session.status = 'failed';
      session.lastError =
        error instanceof Error ? error.message : 'Recordingni saqlab bo‘lmadi';
      session.expiresAt = new Date(Date.now() + RECORDING_EXPIRES_MS);
      await session.save();
      throw error;
    }
  }

  private async appendStreamToFile(
    input: Readable | Buffer | Uint8Array | any,
    output: ReturnType<typeof createWriteStream>,
  ) {
    if (input instanceof Readable) {
      for await (const chunk of input) {
        await this.writeChunk(output, chunk);
      }
      return;
    }

    if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      await this.writeChunk(output, input);
      return;
    }

    if (typeof input?.transformToByteArray === 'function') {
      const bytes = await input.transformToByteArray();
      await this.writeChunk(output, Buffer.from(bytes));
      return;
    }

    if (typeof input?.arrayBuffer === 'function') {
      const arrayBuffer = await input.arrayBuffer();
      await this.writeChunk(output, Buffer.from(arrayBuffer));
    }
  }

  private writeChunk(
    output: ReturnType<typeof createWriteStream>,
    chunk: Buffer | Uint8Array | string,
  ) {
    return new Promise<void>((resolve, reject) => {
      output.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async deleteRecordingAssets(session: VideoRecordingDocument) {
    const keys = [
      session.finalFileKey,
      ...(session.segments || []).map((segment) => segment.key),
    ].filter(Boolean);

    await Promise.all(keys.map((key) => this.r2Service.deleteFile(key)));
  }

  private async convertRecordingToMp4(session: VideoRecordingDocument) {
    if (!session.finalFileKey) {
      throw new BadRequestException('Recording fayli topilmadi');
    }

    const latestSession =
      (await this.recordingModel.findById(session._id).exec()) || session;
    if (
      String(latestSession.fileExtension || '').toLowerCase() === 'mp4' ||
      String(latestSession.mimeType || '').toLowerCase().includes('mp4') ||
      String(latestSession.finalFileKey || '').toLowerCase().endsWith('.mp4')
    ) {
      return latestSession;
    }

    const tempDir = join(
      tmpdir(),
      'jamm-recording-download-convert',
      latestSession._id.toString(),
      randomUUID(),
    );
    await mkdir(tempDir, { recursive: true });

    const inputExtension = latestSession.fileExtension || 'webm';
    const inputPath = join(tempDir, `source.${inputExtension}`);
    const outputPath = join(tempDir, 'download.mp4');

    try {
      await this.downloadObjectToLocalFile(latestSession.finalFileKey, inputPath);

      await execFileAsync('ffmpeg', [
        '-y',
        '-fflags',
        '+genpts',
        '-avoid_negative_ts',
        'make_zero',
        '-i',
        inputPath,
        '-map',
        '0:v:0?',
        '-map',
        '0:a:0?',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath,
      ]);

      const previousFinalKey = latestSession.finalFileKey;
      const nextFilename = replaceFileExtension(latestSession.filename, 'mp4');
      latestSession.filename = nextFilename;
      latestSession.fileExtension = 'mp4';
      latestSession.mimeType = 'video/mp4';
      latestSession.finalFileKey = this.buildFinalKey(latestSession);
      latestSession.finalFileUrl = await this.r2Service.uploadLocalFile(
        outputPath,
        latestSession.finalFileKey,
        'video/mp4',
      );
      await latestSession.save();

      if (previousFinalKey && previousFinalKey !== latestSession.finalFileKey) {
        await this.r2Service.deleteFile(previousFinalKey).catch(() => false);
      }

      return latestSession;
    } catch (error) {
      this.logger.error(
        `Failed to convert downloadable recording ${latestSession._id} to mp4`,
        error as any,
      );
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
