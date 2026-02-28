import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface PresenceStatusEvent {
    userId: string;
    status: 'online' | 'offline';
    timestamp: number;
}
export declare class RedisPresenceService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private client;
    private publisher;
    private subscriber;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
    setOnline(userId: string): Promise<number>;
    refreshTTL(userId: string): Promise<void>;
    removeDevice(userId: string): Promise<number>;
    isOnline(userId: string): Promise<boolean>;
    getOnlineStatuses(userIds: string[]): Promise<Record<string, boolean>>;
    publishStatusChange(userId: string, status: 'online' | 'offline'): Promise<void>;
    subscribeToStatusChanges(callback: (event: PresenceStatusEvent) => void): Promise<void>;
}
