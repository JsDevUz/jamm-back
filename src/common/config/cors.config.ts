import { ConfigService } from '@nestjs/config';

const normalizeOrigin = (value: string): string => String(value || '').trim().replace(/\/+$/, '');
const normalizeHost = (value: string): string => {
  try {
    return new URL(normalizeOrigin(value)).hostname.toLowerCase();
  } catch {
    return '';
  }
};

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

const buildOriginAliases = (origin: string): string[] => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return [];

  const aliases = new Set<string>([normalized]);
  const host = normalizeHost(normalized);

  if (host.startsWith('www.')) {
    aliases.add(normalized.replace('://www.', '://'));
  } else if (host && host.split('.').length >= 2 && !host.includes('localhost')) {
    aliases.add(normalized.replace('://', '://www.'));
  }

  return Array.from(aliases);
};

export const getAllowedOrigins = (configService?: ConfigService): string[] => {
  const configuredOrigins = [
    ...(parseAllowedOrigins(
      configService?.get<string>('CORS_ORIGINS') || process.env.CORS_ORIGINS,
    )),
    normalizeOrigin(
      configService?.get<string>('FRONTEND_APP_URL') || process.env.FRONTEND_APP_URL || '',
    ),
    normalizeOrigin(
      configService?.get<string>('APP_CLIENT_URL') || process.env.APP_CLIENT_URL || '',
    ),
    normalizeOrigin(
      configService?.get<string>('VITE_APP_URL') || process.env.VITE_APP_URL || '',
    ),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8081',
  ].filter(Boolean);

  const uniqueOrigins = new Set<string>();
  configuredOrigins.forEach((origin) => {
    buildOriginAliases(origin).forEach((alias) => uniqueOrigins.add(alias));
  });

  return Array.from(uniqueOrigins);
};
