import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PremiumService } from './premium.service';
import { PremiumController } from './premium.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PromoCode, PromoCodeSchema } from './schemas/promo-code.schema';
import { PremiumPlan, PremiumPlanSchema } from './schemas/premium-plan.schema';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { PresenceModule } from '../presence/presence.module';
import { PremiumCronService } from './premium-cron.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: PremiumPlan.name, schema: PremiumPlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    PresenceModule, // For Redis access if needed, or we can use RedisPresenceService
  ],
  providers: [PremiumService, PremiumCronService],
  controllers: [PremiumController],
  exports: [PremiumService],
})
export class PremiumModule {}
