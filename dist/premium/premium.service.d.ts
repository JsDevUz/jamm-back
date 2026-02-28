import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../users/schemas/user.schema';
import { PromoCodeDocument } from './schemas/promo-code.schema';
import { PremiumPlan, PremiumPlanDocument } from './schemas/premium-plan.schema';
import { SubscriptionDocument } from './schemas/subscription.schema';
import { RedisPresenceService } from '../presence/redis-presence.service';
export declare class PremiumService {
    private userModel;
    private promoCodeModel;
    private premiumPlanModel;
    private subscriptionModel;
    private configService;
    private redisPresence;
    private readonly logger;
    private readonly PREMIUM_CACHE_PREFIX;
    constructor(userModel: Model<UserDocument>, promoCodeModel: Model<PromoCodeDocument>, premiumPlanModel: Model<PremiumPlanDocument>, subscriptionModel: Model<SubscriptionDocument>, configService: ConfigService, redisPresence: RedisPresenceService);
    onModuleInit(): Promise<void>;
    private seedPlans;
    private hashPromoCode;
    redeemPromo(userId: string, code: string): Promise<{
        success: boolean;
        expiresAt: Date;
    }>;
    getPremiumStatus(userId: string): Promise<string>;
    hasFeature(userId: string, feature: string): Promise<boolean>;
    getPlans(): Promise<PremiumPlan[]>;
}
