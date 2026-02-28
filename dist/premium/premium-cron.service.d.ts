import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { SubscriptionDocument } from './schemas/subscription.schema';
export declare class PremiumCronService implements OnModuleInit, OnModuleDestroy {
    private userModel;
    private subscriptionModel;
    private readonly logger;
    private interval;
    constructor(userModel: Model<UserDocument>, subscriptionModel: Model<SubscriptionDocument>);
    onModuleInit(): void;
    onModuleDestroy(): void;
    handleExpiration(): Promise<void>;
}
