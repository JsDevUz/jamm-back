import { HttpException, HttpStatus } from '@nestjs/common';

export class SocketRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  take(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const bucket = (this.buckets.get(key) || []).filter(
      (entry) => now - entry < windowMs,
    );
    if (bucket.length >= limit) {
      throw new HttpException(
        'Socket event rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    bucket.push(now);
    this.buckets.set(key, bucket);
  }
}
