import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.normalizeEndpoint(
      this.readFirstDefined([
        'OBJECT_STORAGE_ENDPOINT',
        'STORAGE_S3_ENDPOINT',
        'B2_S3_ENDPOINT',
      ]) || this.buildLegacyR2Endpoint(),
    );
    const accessKeyId =
      this.readFirstDefined([
        'OBJECT_STORAGE_ACCESS_KEY_ID',
        'STORAGE_S3_ACCESS_KEY_ID',
        'B2_ACCESS_KEY_ID',
        'R2_ACCESS_KEY_ID',
      ]) || '';
    const secretAccessKey =
      this.readFirstDefined([
        'OBJECT_STORAGE_SECRET_ACCESS_KEY',
        'STORAGE_S3_SECRET_ACCESS_KEY',
        'B2_SECRET_ACCESS_KEY',
        'R2_SECRET_ACCESS_KEY',
      ]) || '';
    const region =
      this.readFirstDefined([
        'OBJECT_STORAGE_REGION',
        'STORAGE_S3_REGION',
        'B2_REGION',
        'R2_REGION',
      ]) || 'auto';

    this.bucketName =
      this.readFirstDefined([
        'OBJECT_STORAGE_BUCKET_NAME',
        'STORAGE_S3_BUCKET_NAME',
        'B2_BUCKET_NAME',
        'R2_BUCKET_NAME',
      ]) || '';
    this.publicDomain =
      this.normalizePublicBaseUrl(
        this.readFirstDefined([
          'OBJECT_STORAGE_PUBLIC_BASE_URL',
          'STORAGE_CDN_BASE_URL',
          'B2_PUBLIC_BASE_URL',
          'CDN_PUBLIC_BASE_URL',
          'R2_PUBLIC_DOMAIN',
        ]) || '',
      ) || '';
    const forcePathStyle = this.readBooleanConfig([
      'OBJECT_STORAGE_FORCE_PATH_STYLE',
      'STORAGE_S3_FORCE_PATH_STYLE',
      'B2_FORCE_PATH_STYLE',
    ]);

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private readFirstDefined(keys: string[]): string {
    for (const key of keys) {
      const value = this.configService.get<string>(key);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private readBooleanConfig(keys: string[]): boolean | undefined {
    const raw = this.readFirstDefined(keys);
    if (!raw) return undefined;
    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
  }

  private buildLegacyR2Endpoint(): string {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
    return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
  }

  private normalizePublicBaseUrl(value: string): string {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  private normalizeEndpoint(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, '');
    }
    return `https://${raw.replace(/\/+$/, '')}`;
  }

  private extractObjectKey(key: string): string {
    if (!key) return '';

    if (this.publicDomain && key.includes(this.publicDomain)) {
      return key.split(`${this.publicDomain}/`)[1] || '';
    }

    if (key.startsWith('http')) {
      try {
        const url = new URL(key);
        return url.pathname.replace(/^\/+/, '');
      } catch {
        return '';
      }
    }

    return key;
  }

  isManagedFile(key: string): boolean {
    const cleanKey = this.extractObjectKey(key);
    if (!cleanKey) return false;
    if (!key.startsWith('http')) return true;
    return Boolean(this.publicDomain && key.startsWith(this.publicDomain));
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'avatars',
  ): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      if (this.publicDomain) {
        return `${this.publicDomain}/${fileName}`;
      }

      return fileName;
    } catch (error) {
      console.error('Object storage upload error:', error);
      throw new InternalServerErrorException(
        'Faylni yuklashda xatolik yuz berdi',
      );
    }
  }

  async uploadBuffer(
    body: Buffer | string,
    key: string,
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      if (this.publicDomain) {
        return `${this.publicDomain}/${key}`;
      }

      return key;
    } catch (error) {
      console.error('Object storage buffer upload error:', error);
      throw new InternalServerErrorException(
        'Faylni yuklashda xatolik yuz berdi',
      );
    }
  }

  async getFileStream(
    key: string,
    range?: string,
  ): Promise<{
    stream: any;
    contentType: string;
    contentLength: number;
    contentRange?: string;
    acceptRanges?: string;
  }> {
    try {
      // Remove public domain prefix if key includes it
      const cleanKey = this.extractObjectKey(key);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
        Range: range || undefined,
      });

      const response = await this.s3Client.send(command);

      return {
        stream: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        contentRange: response.ContentRange,
        acceptRanges: response.AcceptRanges,
      };
    } catch (error) {
      console.error('Object storage get stream error:', error);
      throw new InternalServerErrorException(
        "Faylni o'qishda xatolik yuz berdi",
      );
    }
  }

  async getFileText(key: string): Promise<string> {
    const { stream } = await this.getFileStream(key);

    if (stream?.transformToString) {
      return stream.transformToString();
    }

    if (stream instanceof Readable) {
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks).toString('utf-8');
    }

    if (Buffer.isBuffer(stream)) {
      return stream.toString('utf-8');
    }

    return String(stream || '');
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      if (!key) return false;

      // Extract raw key if a URL is provided
      const cleanKey = this.extractObjectKey(key);

      if (!cleanKey) return false;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Object storage delete error:', error);
      return false;
    }
  }
}
