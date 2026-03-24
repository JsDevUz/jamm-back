import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppSetting,
  AppSettingDocument,
  OfficialProfileConfig,
} from './schemas/app-setting.schema';

@Injectable()
export class AppSettingsService {
  private readonly defaultOfficialProfiles: OfficialProfileConfig[] = [
    {
      username: 'jamm',
      badgeKey: 'official',
      badgeLabel: 'Rasmiy',
      disableCalls: true,
      disableGroupInvites: true,
      hidePresence: true,
    },
    {
      username: 'premium',
      badgeKey: 'support',
      badgeLabel: 'Support',
      disableCalls: true,
      disableGroupInvites: true,
      hidePresence: true,
    },
    {
      username: 'ceo',
      badgeKey: 'ceo',
      badgeLabel: 'CEO',
      disableCalls: true,
      disableGroupInvites: true,
      hidePresence: true,
    },
  ];

  private officialProfilesCache:
    | { expiresAt: number; map: Map<string, OfficialProfileConfig> }
    | null = null;

  constructor(
    @InjectModel(AppSetting.name)
    private appSettingModel: Model<AppSettingDocument>,
  ) {}

  async getSettingsDocument() {
    let settings = await this.appSettingModel.findOne({ key: 'global' }).exec();
    if (!settings) {
      settings = await this.appSettingModel.create({
        key: 'global',
        officialProfiles: this.defaultOfficialProfiles,
      });
    } else if (!Array.isArray(settings.officialProfiles) || !settings.officialProfiles.length) {
      settings.officialProfiles = this.defaultOfficialProfiles;
      await settings.save();
    }
    return settings;
  }

  async getOfficialProfiles() {
    const settings = await this.getSettingsDocument();
    return Array.isArray(settings.officialProfiles)
      ? settings.officialProfiles
      : [];
  }

  async getOfficialProfileMap() {
    const now = Date.now();
    if (this.officialProfilesCache && this.officialProfilesCache.expiresAt > now) {
      return this.officialProfilesCache.map;
    }

    const profiles = await this.getOfficialProfiles();
    const map = new Map<string, OfficialProfileConfig>();
    profiles.forEach((profile) => {
      if (profile?.username) {
        map.set(String(profile.username).trim().toLowerCase(), profile);
      }
    });

    this.officialProfilesCache = {
      expiresAt: now + 60_000,
      map,
    };
    return map;
  }

  async getOfficialProfileByUsername(username?: string | null) {
    if (!username) return null;
    const map = await this.getOfficialProfileMap();
    return map.get(String(username).trim().toLowerCase()) || null;
  }

  async decorateUserPayload<T extends Record<string, any>>(user: T | null) {
    if (!user) return null;
    const officialProfile = await this.getOfficialProfileByUsername(user.username);
    return {
      ...user,
      isOfficialProfile: Boolean(officialProfile),
      officialBadgeKey: officialProfile?.badgeKey || null,
      officialBadgeLabel: officialProfile?.badgeLabel || null,
      hidePresence: officialProfile?.hidePresence ?? false,
      disableCalls: officialProfile?.disableCalls ?? false,
      disableGroupInvites:
        Boolean(user.disableGroupInvites) ||
        Boolean(officialProfile?.disableGroupInvites),
    };
  }

  async decorateUsersPayload<T extends Record<string, any>>(users: T[] = []) {
    if (!Array.isArray(users) || !users.length) return [];
    const map = await this.getOfficialProfileMap();
    return users.map((user) => {
      const officialProfile = user?.username
        ? map.get(String(user.username).trim().toLowerCase())
        : null;
      return {
        ...user,
        isOfficialProfile: Boolean(officialProfile),
        officialBadgeKey: officialProfile?.badgeKey || null,
        officialBadgeLabel: officialProfile?.badgeLabel || null,
        hidePresence: officialProfile?.hidePresence ?? false,
        disableCalls: officialProfile?.disableCalls ?? false,
        disableGroupInvites:
          Boolean(user?.disableGroupInvites) ||
          Boolean(officialProfile?.disableGroupInvites),
      };
    });
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
