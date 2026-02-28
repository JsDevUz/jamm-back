import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
}
