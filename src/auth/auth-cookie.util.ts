import { ConfigService } from '@nestjs/config';

export const AUTH_COOKIE_NAME = 'jamm_auth';
export const APP_UNLOCK_COOKIE_NAME = 'jamm_unlock';
export const APP_UNLOCK_HEADER_NAME = 'x-app-unlock-token';

const parseBool = (value?: string | null) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

export const getJwtSecret = (configService: ConfigService) => {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

export const buildAuthCookieOptions = (configService: ConfigService) => {
  const secure =
    parseBool(configService.get<string>('AUTH_COOKIE_SECURE')) ||
    configService.get<string>('NODE_ENV') === 'production';
  const sameSite = secure ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  } as const;
};

export const buildAppUnlockCookieOptions = (configService: ConfigService) => {
  const secure =
    parseBool(configService.get<string>('AUTH_COOKIE_SECURE')) ||
    configService.get<string>('NODE_ENV') === 'production';
  const sameSite = secure ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  } as const;
};

export const extractCookieValue = (
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | null => {
  const source = String(cookieHeader || '').trim();
  if (!source) return null;

  const cookies = source.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split('=');
    if (String(rawName || '').trim() !== cookieName) continue;
    return decodeURIComponent(rest.join('=').trim());
  }

  return null;
};

export const extractTokenFromCookieHeader = (
  cookieHeader?: string | null,
): string | null => {
  return extractCookieValue(cookieHeader, AUTH_COOKIE_NAME);
};
