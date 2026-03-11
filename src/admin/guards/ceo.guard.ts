import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppSettingsService } from '../../app-settings/app-settings.service';

@Injectable()
export class CeoGuard implements CanActivate {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Autentifikatsiya talab qilinadi');
    }

    const officialProfile =
      await this.appSettingsService.getOfficialProfileByUsername(
        user.username,
      );

    if (officialProfile?.badgeKey !== 'ceo') {
      throw new ForbiddenException("CEO admin paneliga ruxsat yo'q");
    }

    return true;
  }
}
