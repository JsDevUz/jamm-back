import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppSetting, AppSettingSchema } from './schemas/app-setting.schema';
import { AppSettingsService } from './app-settings.service';
import { AppSettingsController } from './app-settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
    ]),
  ],
  providers: [AppSettingsService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
