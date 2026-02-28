import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';

@Injectable()
export class PremiumCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PremiumCronService.name);
  private interval: NodeJS.Timeout;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  onModuleInit() {
    // Run initial check on startup
    this.handleExpiration();

    // Set up daily check (every 24 hours)
    this.interval = setInterval(
      () => {
        this.handleExpiration();
      },
      24 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  /**
   * Finds all active premium users and subscriptions whose expiration date
   * has passed, and marks them as expired.
   */
  async handleExpiration() {
    this.logger.log('Starting daily premium expiration check...');
    const now = new Date();

    try {
      // 1. Mark subscriptions as expired in DB
      const subResult = await this.subscriptionModel.updateMany(
        {
          status: 'active',
          expiresAt: { $lt: now },
        },
        { status: 'expired' },
      );

      // 2. Update user status
      const userResult = await this.userModel.updateMany(
        {
          premiumStatus: 'active',
          premiumExpiresAt: { $lt: now },
        },
        { premiumStatus: 'expired' },
      );

      this.logger.log(
        `Checked expirations. Subscriptions updated: ${subResult.modifiedCount}, Users updated: ${userResult.modifiedCount}`,
      );
    } catch (error) {
      this.logger.error('Failed to run monthly expiration check', error);
    }
  }
}
