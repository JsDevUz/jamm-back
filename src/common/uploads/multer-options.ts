import { BadRequestException } from '@nestjs/common';
import type { Options } from 'multer';

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

const DANGEROUS_MIME_PREFIXES = [
  'text/html',
  'application/javascript',
  'text/javascript',
  'application/x-sh',
  'application/x-msdownload',
  'application/x-dosexec',
  'image/svg+xml',
  'text/xml',
  'application/xml',
];

function hasDangerousDoubleExtension(fileName: string) {
  const segments = fileName
    .toLowerCase()
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length < 3) {
    return false;
  }

  return segments
    .slice(1, -1)
    .some((segment) => DANGEROUS_EXTENSIONS.has(`.${segment}`));
}

function assertSafeUploadName(originalName: string) {
  const normalized = String(originalName || '').trim();

  if (!normalized) {
    throw new BadRequestException('Fayl nomi topilmadi');
  }

  if (normalized.length > 180) {
    throw new BadRequestException('Fayl nomi juda uzun');
  }

  if (
    normalized.includes('\0') ||
    normalized.includes('/') ||
    normalized.includes('\\')
  ) {
    throw new BadRequestException('Fayl nomi noto‘g‘ri');
  }

  const lower = normalized.toLowerCase();
  const lastDotIndex = lower.lastIndexOf('.');
  const extension = lastDotIndex >= 0 ? lower.slice(lastDotIndex) : '';

  if (!extension) {
    throw new BadRequestException('Fayl kengaytmasi topilmadi');
  }

  if (DANGEROUS_EXTENSIONS.has(extension) || hasDangerousDoubleExtension(lower)) {
    throw new BadRequestException('Xavfli fayl turi ruxsat etilmagan');
  }
}

export function createSafeSingleFileMulterOptions(maxBytes: number): Options {
  return {
    limits: {
      fileSize: maxBytes,
      files: 1,
      parts: 10,
      fields: 20,
      fieldNameSize: 100,
      fieldSize: 64 * 1024,
      headerPairs: 50,
    },
    fileFilter: (_req, file, callback) => {
      try {
        assertSafeUploadName(file.originalname);

        const mime = String(file.mimetype || '').toLowerCase();
        if (DANGEROUS_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
          throw new BadRequestException('Xavfli fayl turi ruxsat etilmagan');
        }

        callback(null, true);
      } catch (error) {
        (callback as any)(error, false);
      }
    },
  };
}
