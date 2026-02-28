import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const PRESENCE_TTL = 30; // seconds
const PRESENCE_PREFIX = 'online:';
const DEVICE_PREFIX = 'devices:';
const PRESENCE_CHANNEL = 'presence:status';

export interface PresenceStatusEvent {
  userId: string;
  status: 'online' | 'offline';
  timestamp: number;
}

@Injectable()
export class RedisPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPresenceService.name);

  private client: Redis; // For commands (GET, SET, EXPIRE, etc.)
  private publisher: Redis; // For Pub/Sub publishing
  private subscriber: Redis; // For Pub/Sub subscribing

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    const commonOpts = {
      maxRetriesPerRequest: null as any, // Don't crash — keep retrying
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
      lazyConnect: false,
    };

    this.client = new Redis(redisUrl, commonOpts);
    this.publisher = new Redis(redisUrl, commonOpts);
    this.subscriber = new Redis(redisUrl, commonOpts);

    this.client.on('connect', () => this.logger.log('Redis client connected'));
    this.client.on('error', (err) =>
      this.logger.error('Redis client error', err.message),
    );
    this.publisher.on('error', (err) =>
      this.logger.error('Redis publisher error', err.message),
    );
    this.subscriber.on('error', (err) =>
      this.logger.error('Redis subscriber error', err.message),
    );
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.publisher?.quit();
    await this.subscriber?.quit();
  }

  getInternalClient(): Redis {
    return this.client;
  }

  // ─── Presence Keys ──────────────────────────────────────────────────────────

  /**
   * Marks a user as online. Handles multi-device by incrementing a device counter.
   * Both the presence key and device counter get TTL = 30s.
   */
  async setOnline(userId: string): Promise<number> {
    const presenceKey = `${PRESENCE_PREFIX}${userId}`;
    const deviceKey = `${DEVICE_PREFIX}${userId}`;

    const pipeline = this.client.pipeline();
    pipeline.set(presenceKey, '1', 'EX', PRESENCE_TTL);
    pipeline.incr(deviceKey);
    pipeline.expire(deviceKey, PRESENCE_TTL);
    const results = await pipeline.exec();

    const deviceCount = results?.[1]?.[1] as number;

    // Only broadcast "online" if this is the FIRST device
    if (deviceCount === 1) {
      await this.publishStatusChange(userId, 'online');
    }

    return deviceCount;
  }

  /**
   * Refreshes the TTL for a user's presence — called on heartbeat.
   */
  async refreshTTL(userId: string): Promise<void> {
    const presenceKey = `${PRESENCE_PREFIX}${userId}`;
    const deviceKey = `${DEVICE_PREFIX}${userId}`;

    const pipeline = this.client.pipeline();
    pipeline.expire(presenceKey, PRESENCE_TTL);
    pipeline.expire(deviceKey, PRESENCE_TTL);
    await pipeline.exec();
  }

  /**
   * Decrements device count. If no devices remain, lets TTL handle cleanup.
   * Returns remaining device count.
   */
  async removeDevice(userId: string): Promise<number> {
    const deviceKey = `${DEVICE_PREFIX}${userId}`;
    const count = await this.client.decr(deviceKey);

    if (count <= 0) {
      // No devices left — clean up immediately and broadcast offline
      const pipeline = this.client.pipeline();
      pipeline.del(`${PRESENCE_PREFIX}${userId}`);
      pipeline.del(deviceKey);
      await pipeline.exec();

      await this.publishStatusChange(userId, 'offline');
      return 0;
    }

    // Still has devices, refresh TTL
    await this.refreshTTL(userId);
    return count;
  }

  /**
   * O(1) check if a user is online.
   */
  async isOnline(userId: string): Promise<boolean> {
    const exists = await this.client.exists(`${PRESENCE_PREFIX}${userId}`);
    return exists === 1;
  }

  /**
   * Batch check for multiple user IDs. Uses pipeline for efficiency.
   */
  async getOnlineStatuses(userIds: string[]): Promise<Record<string, boolean>> {
    if (userIds.length === 0) return {};

    const pipeline = this.client.pipeline();
    for (const id of userIds) {
      pipeline.exists(`${PRESENCE_PREFIX}${id}`);
    }
    const results = await pipeline.exec();

    const statuses: Record<string, boolean> = {};
    userIds.forEach((id, i) => {
      statuses[id] = results?.[i]?.[1] === 1;
    });
    return statuses;
  }

  // ─── Pub/Sub ────────────────────────────────────────────────────────────────

  /**
   * Publishes a status change event to all server instances.
   */
  async publishStatusChange(
    userId: string,
    status: 'online' | 'offline',
  ): Promise<void> {
    const event: PresenceStatusEvent = {
      userId,
      status,
      timestamp: Date.now(),
    };
    await this.publisher.publish(PRESENCE_CHANNEL, JSON.stringify(event));
  }

  /**
   * Subscribes to status change events from all server instances.
   * Call this once during gateway initialization.
   */
  async subscribeToStatusChanges(
    callback: (event: PresenceStatusEvent) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(PRESENCE_CHANNEL);
    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === PRESENCE_CHANNEL) {
        try {
          const event: PresenceStatusEvent = JSON.parse(message);
          callback(event);
        } catch (err) {
          this.logger.error('Failed to parse presence event', err);
        }
      }
    });
    this.logger.log('Subscribed to presence status changes');
  }
}
