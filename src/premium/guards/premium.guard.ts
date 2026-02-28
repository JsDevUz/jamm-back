import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PremiumService } from '../premium.service';
import { PREMIUM_FEATURE_KEY } from '../decorators/premium-feature.decorator';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private premiumService: PremiumService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(
      PREMIUM_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      return false;
    }

    const premiumStatus = await this.premiumService.getPremiumStatus(
      user.userId,
    );

    if (premiumStatus !== 'active') {
      throw new ForbiddenException(
        'Ushbu amal uchun Premium obuna talab etiladi',
      );
    }

    if (feature) {
      const hasFeature = await this.premiumService.hasFeature(
        user.userId,
        feature,
      );
      if (!hasFeature) {
        throw new ForbiddenException(
          `Sizning tarifingizda "${feature}" imkoniyati mavjud emas`,
        );
      }
    }

    return true;
  }
}
