import { SetMetadata } from '@nestjs/common';

export const PREMIUM_FEATURE_KEY = 'premium_feature';
export const PremiumFeature = (feature: string) =>
  SetMetadata(PREMIUM_FEATURE_KEY, feature);
