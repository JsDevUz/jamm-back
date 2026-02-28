"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisPresenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPresenceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const PRESENCE_TTL = 30;
const PRESENCE_PREFIX = 'online:';
const DEVICE_PREFIX = 'devices:';
const PRESENCE_CHANNEL = 'presence:status';
let RedisPresenceService = RedisPresenceService_1 = class RedisPresenceService {
    configService;
    logger = new common_1.Logger(RedisPresenceService_1.name);
    client;
    publisher;
    subscriber;
    constructor(configService) {
        this.configService = configService;
        const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
        const commonOpts = {
            maxRetriesPerRequest: null,
            retryStrategy: (times) => Math.min(times * 200, 5000),
            lazyConnect: false,
        };
        this.client = new ioredis_1.default(redisUrl, commonOpts);
        this.publisher = new ioredis_1.default(redisUrl, commonOpts);
        this.subscriber = new ioredis_1.default(redisUrl, commonOpts);
        this.client.on('connect', () => this.logger.log('Redis client connected'));
        this.client.on('error', (err) => this.logger.error('Redis client error', err.message));
        this.publisher.on('error', (err) => this.logger.error('Redis publisher error', err.message));
        this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err.message));
    }
    async onModuleDestroy() {
        await this.client?.quit();
        await this.publisher?.quit();
        await this.subscriber?.quit();
    }
    getInternalClient() {
        return this.client;
    }
    async setOnline(userId) {
        const presenceKey = `${PRESENCE_PREFIX}${userId}`;
        const deviceKey = `${DEVICE_PREFIX}${userId}`;
        const pipeline = this.client.pipeline();
        pipeline.set(presenceKey, '1', 'EX', PRESENCE_TTL);
        pipeline.incr(deviceKey);
        pipeline.expire(deviceKey, PRESENCE_TTL);
        const results = await pipeline.exec();
        const deviceCount = results?.[1]?.[1];
        if (deviceCount === 1) {
            await this.publishStatusChange(userId, 'online');
        }
        return deviceCount;
    }
    async refreshTTL(userId) {
        const presenceKey = `${PRESENCE_PREFIX}${userId}`;
        const deviceKey = `${DEVICE_PREFIX}${userId}`;
        const pipeline = this.client.pipeline();
        pipeline.expire(presenceKey, PRESENCE_TTL);
        pipeline.expire(deviceKey, PRESENCE_TTL);
        await pipeline.exec();
    }
    async removeDevice(userId) {
        const deviceKey = `${DEVICE_PREFIX}${userId}`;
        const count = await this.client.decr(deviceKey);
        if (count <= 0) {
            const pipeline = this.client.pipeline();
            pipeline.del(`${PRESENCE_PREFIX}${userId}`);
            pipeline.del(deviceKey);
            await pipeline.exec();
            await this.publishStatusChange(userId, 'offline');
            return 0;
        }
        await this.refreshTTL(userId);
        return count;
    }
    async isOnline(userId) {
        const exists = await this.client.exists(`${PRESENCE_PREFIX}${userId}`);
        return exists === 1;
    }
    async getOnlineStatuses(userIds) {
        if (userIds.length === 0)
            return {};
        const pipeline = this.client.pipeline();
        for (const id of userIds) {
            pipeline.exists(`${PRESENCE_PREFIX}${id}`);
        }
        const results = await pipeline.exec();
        const statuses = {};
        userIds.forEach((id, i) => {
            statuses[id] = results?.[i]?.[1] === 1;
        });
        return statuses;
    }
    async publishStatusChange(userId, status) {
        const event = {
            userId,
            status,
            timestamp: Date.now(),
        };
        await this.publisher.publish(PRESENCE_CHANNEL, JSON.stringify(event));
    }
    async subscribeToStatusChanges(callback) {
        await this.subscriber.subscribe(PRESENCE_CHANNEL);
        this.subscriber.on('message', (channel, message) => {
            if (channel === PRESENCE_CHANNEL) {
                try {
                    const event = JSON.parse(message);
                    callback(event);
                }
                catch (err) {
                    this.logger.error('Failed to parse presence event', err);
                }
            }
        });
        this.logger.log('Subscribed to presence status changes');
    }
};
exports.RedisPresenceService = RedisPresenceService;
exports.RedisPresenceService = RedisPresenceService = RedisPresenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisPresenceService);
//# sourceMappingURL=redis-presence.service.js.map