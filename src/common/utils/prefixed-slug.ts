import { generateShortSlug, sanitizeCustomSlug } from './generate-short-slug';

const PREFIXES = ['+', ':', '-'] as const;

function escapePrefix(prefix: string) {
  return prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripKnownSlugPrefixes(input?: string | null): string {
  const value = String(input || '').trim();
  return value.replace(new RegExp(`^[${PREFIXES.map(escapePrefix).join('')}]+`), '');
}

export function sanitizePrefixedSlug(
  input: string | null | undefined,
  prefix: '+' | ':' | '-',
): string {
  const normalized = sanitizeCustomSlug(stripKnownSlugPrefixes(input));
  return normalized ? `${prefix}${normalized}` : '';
}

export function generatePrefixedShortSlug(
  prefix: '+' | ':' | '-',
  length = 8,
): string {
  return `${prefix}${generateShortSlug(length)}`;
}

export function isPrefixedShortSlug(
  value: string | null | undefined,
  prefix: '+' | ':' | '-',
  length = 8,
): boolean {
  return new RegExp(`^${escapePrefix(prefix)}[a-z0-9]{${length}}$`).test(
    String(value || '').trim(),
  );
}
