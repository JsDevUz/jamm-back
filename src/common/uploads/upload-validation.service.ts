import { BadRequestException, Injectable } from '@nestjs/common';
import { APP_LIMITS } from '../limits/app-limits';
import { MalwareScanService } from './malware-scan.service';
import { extname } from 'node:path';

type UploadFile = Express.Multer.File;

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.htm',
  '.svg',
  '.xml',
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
  '.jar',
  '.php',
  '.py',
  '.rb',
  '.pl',
  '.apk',
  '.ipa',
  '.msi',
  '.iso',
  '.dmg',
  '.com',
  '.scr',
]);

@Injectable()
export class UploadValidationService {
  constructor(private readonly malwareScanService: MalwareScanService) {}

  private assertFileExists(file?: UploadFile | null) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fayl topilmadi');
    }
  }

  private assertMaxSize(file: UploadFile, maxBytes: number, label: string) {
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `${label} maksimal ${Math.round(maxBytes / (1024 * 1024))}MB bo‘lishi kerak`,
      );
    }
  }

  private assertOriginalName(
    file: UploadFile,
    allowedExtensions: string[],
    label: string,
  ) {
    const originalName = String(file.originalname || '').trim();
    if (!originalName) {
      throw new BadRequestException(`${label} nomi topilmadi`);
    }

    if (originalName.length > 180) {
      throw new BadRequestException(`${label} nomi juda uzun`);
    }

    if (
      originalName.includes('\0') ||
      originalName.includes('/') ||
      originalName.includes('\\')
    ) {
      throw new BadRequestException(`${label} nomi noto‘g‘ri`);
    }

    const lowerName = originalName.toLowerCase();
    const extension = extname(lowerName);
    if (!extension) {
      throw new BadRequestException(`${label} kengaytmasi topilmadi`);
    }

    if (DANGEROUS_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`${label} file turi ruxsat etilmagan`);
    }

    const segments = lowerName.split('.').filter(Boolean);
    if (
      segments.length > 2 &&
      segments
        .slice(1, -1)
        .some((segment) => DANGEROUS_EXTENSIONS.has(`.${segment}`))
    ) {
      throw new BadRequestException(`${label} file turi ruxsat etilmagan`);
    }

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(`${label} kengaytmasi ruxsat etilmagan`);
    }
  }

  private assertMime(file: UploadFile, allowed: string[], label: string) {
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`${label} file turi ruxsat etilmagan`);
    }
  }

  private hasSignature(file: UploadFile, signatures: Array<Buffer | string>) {
    return signatures.some((signature) => {
      const expected = Buffer.isBuffer(signature)
        ? signature
        : Buffer.from(signature, 'hex');
      return file.buffer.subarray(0, expected.length).equals(expected);
    });
  }

  private assertImageSignature(file: UploadFile, label: string) {
    const signatures = [
      'ffd8ff',
      '89504e470d0a1a0a',
      '47494638',
      '52494646',
      '000000206674797061766966',
    ];
    if (!this.hasSignature(file, signatures)) {
      throw new BadRequestException(`${label} signaturasi noto‘g‘ri`);
    }
  }

  private assertPdfSignature(file: UploadFile, label: string) {
    if (!this.hasSignature(file, ['25504446'])) {
      throw new BadRequestException(`${label} PDF signaturasi noto‘g‘ri`);
    }
  }

  private assertAudioSignature(file: UploadFile, label: string) {
    const signatures = ['494433', 'fff1', 'fff9', '4f676753', '52494646'];
    if (!this.hasSignature(file, signatures)) {
      throw new BadRequestException(`${label} audio signaturasi noto‘g‘ri`);
    }
  }

  private assertVideoSignature(file: UploadFile, label: string) {
    const hasMp4 = file.buffer.subarray(4, 8).equals(Buffer.from('66747970', 'hex'));
    const hasWebm = this.hasSignature(file, ['1a45dfa3']);
    if (!hasMp4 && !hasWebm) {
      throw new BadRequestException(`${label} video signaturasi noto‘g‘ri`);
    }
  }

  async validateImageUpload(
    file: UploadFile,
    options?: { maxBytes?: number; label?: string },
  ) {
    const label = options?.label || 'Rasm';
    this.assertFileExists(file);
    this.assertMaxSize(file, options?.maxBytes || APP_LIMITS.homeworkPhotoBytes, label);
    this.assertOriginalName(
      file,
      ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'],
      label,
    );
    this.assertMime(
      file,
      [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
      ],
      label,
    );
    this.assertImageSignature(file, label);
    await this.malwareScanService.scanBuffer(file.buffer, label);
  }

  async validateCourseMediaUpload(file: UploadFile) {
    const label = 'Dars media fayli';
    this.assertFileExists(file);
    this.assertMaxSize(file, APP_LIMITS.lessonMediaBytes, label);

    if (file.mimetype.startsWith('video/')) {
      this.assertOriginalName(file, ['.mp4', '.mov', '.webm'], label);
      this.assertMime(
        file,
        ['video/mp4', 'video/quicktime', 'video/webm'],
        label,
      );
      this.assertVideoSignature(file, label);
    } else if (file.mimetype.startsWith('audio/')) {
      this.assertOriginalName(
        file,
        ['.mp3', '.wav', '.ogg', '.webm'],
        label,
      );
      this.assertMime(
        file,
        ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
        label,
      );
      this.assertAudioSignature(file, label);
    } else if (file.mimetype === 'application/pdf') {
      this.assertOriginalName(file, ['.pdf'], label);
      this.assertMime(file, ['application/pdf'], label);
      this.assertPdfSignature(file, label);
    } else {
      throw new BadRequestException('Dars uchun faqat video, audio yoki PDF ruxsat etiladi');
    }

    await this.malwareScanService.scanBuffer(file.buffer, label);
  }

  async validateHomeworkSubmissionFile(file: UploadFile, type: string) {
    const normalized = String(type || 'text').toLowerCase();
    if (normalized === 'text') {
      return;
    }

    const label = 'Uyga vazifa fayli';
    this.assertFileExists(file);

    if (normalized === 'photo') {
      await this.validateImageUpload(file, {
        maxBytes: APP_LIMITS.homeworkPhotoBytes,
        label,
      });
      return;
    }

    if (normalized === 'pdf') {
      this.assertMaxSize(file, APP_LIMITS.homeworkPdfBytes, label);
      this.assertOriginalName(file, ['.pdf'], label);
      this.assertMime(file, ['application/pdf'], label);
      this.assertPdfSignature(file, label);
      await this.malwareScanService.scanBuffer(file.buffer, label);
      return;
    }

    if (normalized === 'audio') {
      this.assertMaxSize(file, APP_LIMITS.homeworkAudioBytes, label);
      this.assertOriginalName(
        file,
        ['.mp3', '.wav', '.ogg', '.webm'],
        label,
      );
      this.assertMime(
        file,
        ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
        label,
      );
      this.assertAudioSignature(file, label);
      await this.malwareScanService.scanBuffer(file.buffer, label);
      return;
    }

    if (normalized === 'video') {
      this.assertMaxSize(file, APP_LIMITS.homeworkVideoBytes, label);
      this.assertOriginalName(file, ['.mp4', '.mov', '.webm'], label);
      this.assertMime(
        file,
        ['video/mp4', 'video/quicktime', 'video/webm'],
        label,
      );
      this.assertVideoSignature(file, label);
      await this.malwareScanService.scanBuffer(file.buffer, label);
      return;
    }

    throw new BadRequestException('Uyga vazifa fayl turi qo‘llab-quvvatlanmaydi');
  }
}
