import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ChatsService } from '../chats/chats.service';
import {
  ProfileDecoration,
  ProfileDecorationDocument,
} from './schemas/profile-decoration.schema';

import { R2Service } from '../common/services/r2.service';
import {
  APP_TEXT_LIMITS,
  assertMaxChars,
} from '../common/limits/app-limits';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Injectable()
export class UsersService {
  private readonly appLockKeyLength = 64;
  private readonly defaultProfileDecorations = [
    {
      key: 'sparkle-gold',
      label: 'Golden Spark',
      emoji: '✨',
      animation: 'sparkle',
      premiumOnly: true,
      sortOrder: 1,
    },
    {
      key: 'fire-pop',
      label: 'Fire Pop',
      emoji: '🔥',
      animation: 'pulse',
      premiumOnly: true,
      sortOrder: 2,
    },
    {
      key: 'rocket-wave',
      label: 'Rocket Wave',
      emoji: '🚀',
      animation: 'float',
      premiumOnly: true,
      sortOrder: 3,
    },
    {
      key: 'diamond-spin',
      label: 'Diamond Spin',
      emoji: '💎',
      animation: 'spin',
      premiumOnly: true,
      sortOrder: 4,
    },
    {
      key: 'star-wiggle',
      label: 'Star Wiggle',
      emoji: '🌟',
      animation: 'wiggle',
      premiumOnly: true,
      sortOrder: 5,
    },
    {
      key: 'heart-float',
      label: 'Heart Float',
      emoji: '💖',
      animation: 'float',
      premiumOnly: true,
      sortOrder: 6,
    },
  ];

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ProfileDecoration.name)
    private profileDecorationModel: Model<ProfileDecorationDocument>,
    private r2Service: R2Service,
    @Inject(forwardRef(() => ChatsService)) private chatsService: ChatsService,
    private appSettingsService: AppSettingsService,
  ) {}

  private async ensureDefaultProfileDecorations() {
    await this.profileDecorationModel.bulkWrite(
      this.defaultProfileDecorations.map((decoration) => ({
        updateOne: {
          filter: { key: decoration.key },
          update: { $setOnInsert: decoration },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async getProfileDecorations() {
    await this.ensureDefaultProfileDecorations();

    return this.profileDecorationModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async updateProfileDecoration(userId: string, decorationId?: string | null) {
    if (!decorationId) {
      return this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: { selectedProfileDecorationId: null } },
          { new: true },
        )
        .select('-password')
        .lean()
        .exec();
    }

    await this.ensureDefaultProfileDecorations();

    const [user, decoration] = await Promise.all([
      this.userModel
        .findById(userId)
        .select('premiumStatus selectedProfileDecorationId')
        .lean()
        .exec(),
      this.profileDecorationModel
        .findOne({ key: decorationId, isActive: true })
        .lean()
        .exec(),
    ]);

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    if (decorationId === 'premium-badge') {
      if (user.premiumStatus !== 'active') {
        throw new ForbiddenException(
          'Bu profil dekoratsiyasi faqat premium obunachilar uchun',
        );
      }

      return this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: { selectedProfileDecorationId: 'premium-badge' } },
          { new: true },
        )
        .select('-password')
        .lean()
        .exec();
    }

    if (decorationId === 'custom-upload') {
      if (user.premiumStatus !== 'active') {
        throw new ForbiddenException(
          'Bu profil dekoratsiyasi faqat premium obunachilar uchun',
        );
      }

      const refreshedUser = await this.userModel
        .findById(userId)
        .select('customProfileDecorationImage')
        .lean()
        .exec();

      if (!refreshedUser?.customProfileDecorationImage) {
        throw new BadRequestException(
          'Avval custom dekoratsiya rasmini yuklang',
        );
      }

      return this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: { selectedProfileDecorationId: 'custom-upload' } },
          { new: true },
        )
        .select('-password')
        .lean()
        .exec();
    }

    if (!decoration) {
      throw new BadRequestException('Dekoratsiya topilmadi');
    }

    if (decoration.premiumOnly && user.premiumStatus !== 'active') {
      throw new ForbiddenException(
        'Bu profil dekoratsiyasi faqat premium obunachilar uchun',
      );
    }

    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { selectedProfileDecorationId: decoration.key } },
        { new: true },
      )
      .select('-password')
      .lean()
      .exec();
  }

  async updateProfileDecorationImage(
    userId: string,
    file: Express.Multer.File,
  ) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus customProfileDecorationImage')
      .lean()
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    if (user.premiumStatus !== 'active') {
      throw new ForbiddenException(
        'Custom profil dekoratsiyasi faqat premium obunachilar uchun',
      );
    }

    const uploadedImage = await this.r2Service.uploadFile(
      file,
      'profile-decorations/custom',
    );

    if (user.customProfileDecorationImage) {
      await this.r2Service.deleteFile(user.customProfileDecorationImage);
    }

    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            customProfileDecorationImage: uploadedImage,
            selectedProfileDecorationId: 'custom-upload',
          },
        },
        { new: true },
      )
      .select('-password')
      .lean()
      .exec();
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    assertMaxChars(
      'Nickname',
      createUserDto.nickname,
      APP_TEXT_LIMITS.nicknameChars,
    );
    assertMaxChars(
      'Username',
      createUserDto.username,
      APP_TEXT_LIMITS.usernameChars,
    );
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  private hashAppLockPin(pin: string, salt = randomBytes(16).toString('hex')) {
    const derivedKey = scryptSync(pin, salt, this.appLockKeyLength).toString(
      'hex',
    );
    return `${salt}:${derivedKey}`;
  }

  private verifyAppLockPinHash(pin: string, storedHash: string) {
    const [salt, expectedHash] = String(storedHash || '').split(':');
    if (!salt || !expectedHash) {
      return false;
    }

    const actualHash = scryptSync(pin, salt, this.appLockKeyLength);
    const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

    if (actualHash.length !== expectedHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualHash, expectedHashBuffer);
  }

  async getAppLockStatus(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('appLockEnabled')
      .lean()
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    return { enabled: Boolean(user.appLockEnabled) };
  }

  async setAppLockPin(
    userId: string,
    pin: string,
    currentPin?: string,
  ): Promise<{ enabled: boolean }> {
    const user = await this.userModel
      .findById(userId)
      .select('+appLockPinHash appLockEnabled')
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    if (user.appLockEnabled) {
      if (!currentPin) {
        throw new BadRequestException('Joriy app parolini kiriting');
      }

      if (
        !user.appLockPinHash ||
        !this.verifyAppLockPinHash(currentPin, user.appLockPinHash)
      ) {
        throw new ForbiddenException("Joriy app paroli noto'g'ri");
      }
    }

    user.appLockPinHash = this.hashAppLockPin(pin);
    user.appLockEnabled = true;
    await user.save();

    return { enabled: true };
  }

  async verifyAppLockPin(userId: string, pin: string) {
    const user = await this.userModel
      .findById(userId)
      .select('+appLockPinHash appLockEnabled')
      .lean()
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    if (!user.appLockEnabled || !user.appLockPinHash) {
      return { valid: false };
    }

    return {
      valid: this.verifyAppLockPinHash(pin, user.appLockPinHash),
    };
  }

  async removeAppLockPin(userId: string, pin: string): Promise<{ enabled: boolean }> {
    const user = await this.userModel
      .findById(userId)
      .select('+appLockPinHash appLockEnabled')
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    if (!user.appLockEnabled || !user.appLockPinHash) {
      return { enabled: false };
    }

    if (!this.verifyAppLockPinHash(pin, user.appLockPinHash)) {
      throw new ForbiddenException("App paroli noto'g'ri");
    }

    user.appLockPinHash = null;
    user.appLockEnabled = false;
    await user.save();

    return { enabled: false };
  }

  async clearAppLockOnLogout(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.userModel
      .findById(userId)
      .select('+appLockPinHash appLockEnabled')
      .exec();

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    user.appLockPinHash = null;
    user.appLockEnabled = false;
    await user.save();

    return { enabled: false };
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ verificationToken: token }).exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  async searchUsers(
    query: string,
    currentUserId: string,
  ): Promise<any[]> {
    if (!query) return [];

    const regex = new RegExp(query, 'i');

    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen selectedProfileDecorationId customProfileDecorationImage';

    const users = await this.userModel
      .find({
        _id: { $ne: currentUserId },
        $or: [{ username: regex }, { nickname: regex }],
      })
      .select(safeFields)
      .limit(10)
      .lean()
      .exec();
    return this.appSettingsService.decorateUsersPayload(users as any[]);
  }

  async searchGlobal(
    query: string,
    currentUserId: string,
  ): Promise<any[]> {
    if (!query) return [];

    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen selectedProfileDecorationId customProfileDecorationImage';

    const isJammId = /^\d+$/.test(query);
    const filter: any = {
      _id: { $ne: currentUserId },
    };

    if (isJammId) {
      filter.jammId = Number(query);
    } else {
      const regex = new RegExp(query, 'i');
      filter.$or = [{ username: regex }, { nickname: regex }];
    }

    const users = await this.userModel
      .find(filter)
      .select(safeFields)
      .limit(10)
      .lean()
      .exec();
    return this.appSettingsService.decorateUsersPayload(users as any[]);
  }

  async getAllUsers(currentUserId: string): Promise<any[]> {
    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen selectedProfileDecorationId customProfileDecorationImage';
    const users = await this.userModel
      .find({ _id: { $ne: currentUserId } })
      .select(safeFields)
      .limit(100)
      .lean()
      .exec();
    return this.appSettingsService.decorateUsersPayload(users as any[]);
  }
  async updateProfile(
    userId: string,
    data: {
      nickname?: string;
      username?: string;
      phone?: string;
      avatar?: string;
      bio?: string;
    },
  ): Promise<UserDocument | null> {
    assertMaxChars('Nickname', data.nickname, APP_TEXT_LIMITS.nicknameChars);
    assertMaxChars('Username', data.username, APP_TEXT_LIMITS.usernameChars);
    assertMaxChars('Bio', data.bio, APP_TEXT_LIMITS.bioChars);

    if (data.username) {
      const existingUser = await this.userModel
        .findOne({ username: data.username })
        .exec();
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new BadRequestException(
          'Ushbu username band. Iltimos, boshqa username tanlang.',
        );
      }
    }

    const existingUser = await this.userModel
      .findById(userId)
      .select('avatar')
      .exec();

    const previousAvatar = existingUser?.avatar || '';
    const nextAvatar =
      data.avatar !== undefined ? String(data.avatar || '') : previousAvatar;

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, { $set: data }, { new: true })
      .select('-password')
      .exec();

    if (
      previousAvatar &&
      previousAvatar !== nextAvatar &&
      this.r2Service.isManagedFile(previousAvatar)
    ) {
      try {
        await this.r2Service.deleteFile(previousAvatar);
      } catch (error) {
        console.error('Old avatar cleanup failed:', error);
      }
    }

    return updatedUser;
  }

  async updateAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserDocument | null> {
    try {
      const avatarUrl = await this.r2Service.uploadFile(file, 'avatars');
      return this.updateProfile(userId, { avatar: avatarUrl });
    } catch (error) {
      throw new InternalServerErrorException(
        'Avatar yuklashda xatolik yuz berdi',
      );
    }
  }

  async uploadAvatarOnly(file: Express.Multer.File): Promise<string> {
    try {
      return await this.r2Service.uploadFile(file, 'avatars');
    } catch (error) {
      throw new InternalServerErrorException(
        'Avatar yuklashda xatolik yuz berdi',
      );
    }
  }

  async toggleFollow(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ following: boolean; followersCount: number }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException("O'zingizga obuna bo'lolmaysiz");
    }

    const currentId = new Types.ObjectId(currentUserId);
    const isJammId = /^\d{5,7}$/.test(String(targetUserId || '').trim());
    const target = await this.userModel
      .findOne(
        isJammId
          ? { jammId: Number(targetUserId) }
          : { _id: targetUserId },
      )
      .select('_id followers')
      .exec();
    if (!target) throw new BadRequestException('Foydalanuvchi topilmadi');
    if (target._id.equals(currentId)) {
      throw new BadRequestException("O'zingizga obuna bo'lolmaysiz");
    }

    const targetId = target._id as Types.ObjectId;

    const isFollowing = (target.followers || []).some((id) =>
      id.equals(currentId),
    );

    if (isFollowing) {
      // Unfollow
      await this.userModel.findByIdAndUpdate(targetId, {
        $pull: { followers: currentId },
      });
      await this.userModel.findByIdAndUpdate(currentId, {
        $pull: { following: targetId },
      });
    } else {
      // Follow
      await this.userModel.findByIdAndUpdate(targetId, {
        $addToSet: { followers: currentId },
      });
      await this.userModel.findByIdAndUpdate(currentId, {
        $addToSet: { following: targetId },
      });
    }

    const updated = await this.userModel.findById(targetId);
    return {
      following: !isFollowing,
      followersCount: updated?.followers?.length || 0,
    };
  }

  async getPublicProfile(
    identifier: string,
    currentUserId?: string,
  ): Promise<any> {
    // identifier can be jammId (5-7 digit number) or MongoDB ObjectId
    const isJammId = /^\d{5,7}$/.test(identifier);
    const user = await this.userModel
      .findOne(isJammId ? { jammId: Number(identifier) } : { _id: identifier })
      .select('-password')
      .exec();
    if (!user) return null;

    const obj = (user as any).toObject();
    const currentId = currentUserId ? new Types.ObjectId(currentUserId) : null;

    return this.appSettingsService.decorateUserPayload({
      _id: obj._id,
      jammId: obj.jammId,
      username: obj.username,
      nickname: obj.nickname,
      avatar: obj.avatar,
      bio: obj.bio || '',
      premiumStatus: obj.premiumStatus,
      selectedProfileDecorationId: obj.selectedProfileDecorationId || null,
      customProfileDecorationImage: obj.customProfileDecorationImage || null,
      followersCount: obj.followers?.length || 0,
      followingCount: obj.following?.length || 0,
      isFollowing: currentId
        ? (obj.followers || []).some((id: any) =>
            new Types.ObjectId(id).equals(currentId),
          )
        : false,
      createdAt: obj.createdAt,
    });
  }

  async completeOnboarding(
    userId: string,
    data: Record<string, any>,
  ): Promise<UserDocument | null> {
    const { username, gender, age, ...rest } = data;

    const updates: any = {
      onboardingData: rest,
      isOnboardingCompleted: true,
    };

    if (username) updates.username = username;
    if (gender) updates.gender = gender;
    if (age) updates.age = Number(age);

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updates }, { new: true })
      .select('-password')
      .exec();

    try {
      if (user) {
        const jammUser = await this.userModel
          .findOne({ username: 'jamm' }, { _id: 1 })
          .exec();
        if (jammUser) {
          const jammId = jammUser._id.toString();

          const chat = await this.chatsService.createChat(jammId, {
            isGroup: false,
            memberIds: [userId],
          });

          const nickname = user.nickname || user.username || "Do'st";
          await this.chatsService.sendMessage(
            chat._id.toString(),
            jammId,
            `Xush kelibsiz ${nickname}!`,
          );
        }
      }
    } catch (error) {
      console.error('Failed to send welcome message from @Jamm:', error);
    }

    return user;
  }
}
