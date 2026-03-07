import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppSetting,
  AppSettingDocument,
} from './schemas/app-setting.schema';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectModel(AppSetting.name)
    private appSettingModel: Model<AppSettingDocument>,
  ) {}

  async getSettingsDocument() {
    let settings = await this.appSettingModel.findOne({ key: 'global' }).exec();
    if (!settings) {
      settings = await this.appSettingModel.create({ key: 'global' });
    }
    return settings;
  }

  async getPublicStatus() {
    const settings = await this.getSettingsDocument();
    return {
      maintenanceMode: Boolean(settings.maintenanceMode),
      maintenanceMessage:
        settings.maintenanceMessage?.trim() ||
        'Texnik ishlar olib borilmoqda. Iltimos, birozdan keyin qayta urinib ko‘ring.',
    };
  }
}
