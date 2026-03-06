import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
    const accessKeyId =
      this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';

    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicDomain =
      this.configService.get<string>('R2_PUBLIC_DOMAIN') || '';

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
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

      // Return the public URL
      // If publicDomain is provided, use it. Otherwise, return the key for internal use or construct a default R2 URL if public.
      if (this.publicDomain) {
        return `${this.publicDomain}/${fileName}`;
      }

      return fileName; // Fallback to key if no public domain is set
    } catch (error) {
      console.error('R2 Upload Error:', error);
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
      let cleanKey = key;
      if (this.publicDomain && key.startsWith(this.publicDomain)) {
        cleanKey = key.replace(`${this.publicDomain}/`, '');
      } else if (key.startsWith('http')) {
        const parts = key.split('/');
        cleanKey = parts.slice(3).join('/'); // rough extraction
      }

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
      console.error('R2 GetStream Error:', error);
      throw new InternalServerErrorException(
        "Faylni o'qishda xatolik yuz berdi",
      );
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      if (!key) return false;

      // Extract raw key if a URL is provided
      let cleanKey = key;
      if (this.publicDomain && key.includes(this.publicDomain)) {
        cleanKey = key.split(`${this.publicDomain}/`)[1];
      } else if (key.startsWith('http')) {
        const parts = key.split('/');
        cleanKey = parts.slice(3).join('/');
      }

      if (!cleanKey) return false;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('R2 Delete Error:', error);
      // We don't throw error here to avoid blocking course/doc deletion if file is already gone
      return false;
    }
  }
}
