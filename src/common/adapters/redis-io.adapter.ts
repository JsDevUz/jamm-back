import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Socket.IO adapter backed by Redis pub/sub. Allows multiple jamm-server
 * instances to broadcast to the same room — required for horizontal scaling
 * (whiteboard strokes, cursors, signaling all fan out across nodes).
 *
 * Falls back silently to the in-memory adapter if Redis is unreachable so a
 * single-node deploy keeps working.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const commonOpts = {
      maxRetriesPerRequest: null as any,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
      lazyConnect: false,
    };

    try {
      const pubClient = new Redis(redisUrl, commonOpts);
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) =>
        this.logger.error('Redis pub client error', err.message),
      );
      subClient.on('error', (err) =>
        this.logger.error('Redis sub client error', err.message),
      );

      await Promise.all([
        new Promise<void>((resolve) => {
          if (pubClient.status === 'ready') return resolve();
          pubClient.once('ready', () => resolve());
        }),
        new Promise<void>((resolve) => {
          if (subClient.status === 'ready') return resolve();
          subClient.once('ready', () => resolve());
        }),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.IO Redis adapter connected');
    } catch (err) {
      this.logger.error(
        'Redis adapter init failed — falling back to in-memory',
        (err as Error).message,
      );
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
