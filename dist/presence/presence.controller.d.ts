import { RedisPresenceService } from './redis-presence.service';
export declare class PresenceController {
    private readonly redisPresence;
    constructor(redisPresence: RedisPresenceService);
    getUserStatus(userId: string): Promise<{
        userId: string;
        online: boolean;
    }>;
    getBulkStatus(body: {
        userIds: string[];
    }): Promise<{
        statuses: Record<string, boolean>;
    }>;
}
