import { Controller, Get } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';

@Controller('app')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get('status')
  getStatus() {
    return this.appSettingsService.getPublicStatus();
  }
}
