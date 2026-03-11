import { ConfigService } from '@nestjs/config';

const normalizeOrigin = (value: string): string => String(value || '').trim().replace(/\/+$/, '');

export const parseAllowedOrigins = (value?: string | null): string[] => {
  const raw = String(value || '').trim();

  if (!raw) {
    return [];
  }

  const origins = raw
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  return origins;
};

export const getAllowedOrigins = (configService?: ConfigService): string[] =>
  parseAllowedOrigins(
    configService?.get<string>('CORS_ORIGINS') || process.env.CORS_ORIGINS,
  );
