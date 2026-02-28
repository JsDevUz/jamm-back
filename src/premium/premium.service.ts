import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PromoCode, PromoCodeDocument } from './schemas/promo-code.schema';
import {
  PremiumPlan,
  PremiumPlanDocument,
} from './schemas/premium-plan.schema';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';
import { RedisPresenceService } from '../presence/redis-presence.service';

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);
  private readonly PREMIUM_CACHE_PREFIX = 'premium_status:';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PromoCode.name)
    private promoCodeModel: Model<PromoCodeDocument>,
    @InjectModel(PremiumPlan.name)
    private premiumPlanModel: Model<PremiumPlanDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private configService: ConfigService,
    private redisPresence: RedisPresenceService,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  private async seedPlans() {
    const plansCount = await this.premiumPlanModel.countDocuments();
    if (plansCount === 0) {
      const defaultPlans = [
        {
          name: '1 Oy',
          durationInDays: 30,
          price: 5,
          features: ['group_limit_10', 'priority_support'],
        },
        {
          name: '3 Oy',
          durationInDays: 90,
          price: 12,
          features: ['group_limit_10', 'priority_support'],
        },
        {
          name: '6 Oy',
          durationInDays: 180,
          price: 20,
          features: ['group_limit_10', 'priority_support'],
        },
        {
          name: '12 Oy',
          durationInDays: 365,
          price: 35,
          features: ['group_limit_10', 'priority_support'],
        },
      ];
      await this.premiumPlanModel.create(defaultPlans);
      this.logger.log('Default premium plans seeded');
    }
  }

  private hashPromoCode(code: string): string {
    const salt =
      this.configService.get<string>('PROMO_SALT') || 'default-promo-salt-!!';
    return crypto.createHmac('sha256', salt).update(code).digest('hex');
  }

  async redeemPromo(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; expiresAt: Date }> {
    const hashedCode = this.hashPromoCode(code);
    const now = new Date();

    // 1. Find user and check if already used a promo
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.hasUsedPromo) {
      throw new BadRequestException(
        'Siz allaqachon promo-koddan foydalangansiz',
      );
    }

    // 2. Find and validate promo
    const promo = await this.promoCodeModel.findOne({
      code: hashedCode,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    if (!promo) {
      throw new BadRequestException("Promo-kod yaroqsiz yoki muddati o'tgan");
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException('Promo-kod foydalanish limiti tugagan');
    }

    // 3. Atomic Update Promo and User (Transaction would be better for high scale,
    // but atomic updates with checks are usually sufficient for this case)

    // Update promo used count atomically
    const promoUpdate = await this.promoCodeModel.findOneAndUpdate(
      { _id: promo._id, usedCount: promo.usedCount },
      { $inc: { usedCount: 1 } },
      { new: true },
    );

    if (!promoUpdate) {
      // Race condition: someone else used it just now
      throw new BadRequestException('Afsuski, promo-kod hozirgina tugadi');
    }

    // Activate Premium for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.userModel.findByIdAndUpdate(userId, {
      premiumStatus: 'active',
      premiumExpiresAt: expiresAt,
      hasUsedPromo: true,
    });

    // Record Subscription
    await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      startedAt: now,
      expiresAt: expiresAt,
      status: 'active',
      paymentProvider: 'promo',
    });

    // Update Cache
    const redis = this.redisPresence.getInternalClient();
    await redis.set(
      `${this.PREMIUM_CACHE_PREFIX}${userId}`,
      'active',
      'EX',
      3600,
    ); // 1 hour cache

    this.logger.log(`User ${userId} redeemed promo code`);

    return { success: true, expiresAt };
  }

  async getPremiumStatus(userId: string): Promise<string> {
    const redis = this.redisPresence.getInternalClient();
    const cached = await redis.get(`${this.PREMIUM_CACHE_PREFIX}${userId}`);
    if (cached) return cached;

    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus premiumExpiresAt');
    if (!user) return 'none';

    const now = new Date();
    if (
      user.premiumStatus === 'active' &&
      user.premiumExpiresAt &&
      user.premiumExpiresAt > now
    ) {
      await redis.set(
        `${this.PREMIUM_CACHE_PREFIX}${userId}`,
        'active',
        'EX',
        3600,
      );
      return 'active';
    }

    if (user.premiumStatus === 'active') {
      // Handle auto-expiration if not done by cron yet
      await this.userModel.findByIdAndUpdate(userId, {
        premiumStatus: 'expired',
      });
    }

    await redis.set(
      `${this.PREMIUM_CACHE_PREFIX}${userId}`,
      'none',
      'EX',
      3600,
    );
    return 'none';
  }

  async hasFeature(userId: string, feature: string): Promise<boolean> {
    const status = await this.getPremiumStatus(userId);
    if (status !== 'active') return false;

    // In a real system, you'd check the plan features.
    // For now, if active, they have access to standard premium features.
    return true;
  }

  async getPlans(): Promise<PremiumPlan[]> {
    return this.premiumPlanModel.find().exec();
  }
}
