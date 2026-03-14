import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppSettingsService } from '../../app-settings/app-settings.service';

@Injectable()
export class AppAccessGuard implements CanActivate {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request?.path || request?.url || '';

    if (
      path.startsWith('/app/status') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/signup') ||
      path.startsWith('/auth/verify') ||
      path.startsWith('/auth/forgot-password') ||
      path.startsWith('/auth/reset-password')
    ) {
      return true;
    }

    const status = await this.appSettingsService.getPublicStatus();
    if (status.maintenanceMode) {
      throw new ServiceUnavailableException(status.maintenanceMessage);
    }

    return true;
  }
}
