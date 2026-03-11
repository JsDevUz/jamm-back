import { Model } from 'mongoose';
import { RedisPresenceService } from './redis-presence.service';
import { UserDocument } from '../users/schemas/user.schema';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { BulkStatusDto } from './dto/bulk-status.dto';
export declare class PresenceController {
    private readonly redisPresence;
    private readonly userModel;
    private readonly appSettingsService;
    constructor(redisPresence: RedisPresenceService, userModel: Model<UserDocument>, appSettingsService: AppSettingsService);
    getUserStatus(userId: string): Promise<{
        userId: string;
        online: boolean;
    }>;
    getBulkStatus(body: BulkStatusDto): Promise<{
        statuses: Record<string, boolean>;
    }>;
}
