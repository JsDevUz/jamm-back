const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateShortSlug(length = 8): string {
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += SLUG_ALPHABET.charAt(
      Math.floor(Math.random() * SLUG_ALPHABET.length),
    );
  }

  return value;
}

export function sanitizeCustomSlug(input?: string | null): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
