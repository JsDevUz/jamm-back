import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ChatsService } from '../chats/chats.service';

import { R2Service } from '../common/services/r2.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private r2Service: R2Service,
    @Inject(forwardRef(() => ChatsService)) private chatsService: ChatsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ verificationToken: token }).exec();
  }

  async searchUsers(
    query: string,
    currentUserId: string,
  ): Promise<UserDocument[]> {
    if (!query) return [];

    const regex = new RegExp(query, 'i');

    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';

    return this.userModel
      .find({
        _id: { $ne: currentUserId },
        $or: [{ username: regex }, { nickname: regex }],
      })
      .select(safeFields)
      .limit(10)
      .exec();
  }

  async searchGlobal(
    query: string,
    currentUserId: string,
  ): Promise<UserDocument[]> {
    if (!query) return [];

    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';

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

    return this.userModel.find(filter).select(safeFields).limit(10).exec();
  }

  async getAllUsers(currentUserId: string): Promise<UserDocument[]> {
    const safeFields =
      '_id jammId username nickname avatar bio premiumStatus isVerified lastSeen';
    return this.userModel
      .find({ _id: { $ne: currentUserId } })
      .select(safeFields)
      .limit(100)
      .exec();
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

    return this.userModel
      .findByIdAndUpdate(userId, { $set: data }, { new: true })
      .select('-password')
      .exec();
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

  async toggleFollow(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ following: boolean; followersCount: number }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException("O'zingizga obuna bo'lolmaysiz");
    }

    const currentId = new Types.ObjectId(currentUserId);
    const targetId = new Types.ObjectId(targetUserId);

    const target = await this.userModel.findById(targetId);
    if (!target) throw new BadRequestException('Foydalanuvchi topilmadi');

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

    return {
      _id: obj._id,
      jammId: obj.jammId,
      username: obj.username,
      nickname: obj.nickname,
      avatar: obj.avatar,
      bio: obj.bio || '',
      premiumStatus: obj.premiumStatus,
      followersCount: obj.followers?.length || 0,
      followingCount: obj.following?.length || 0,
      isFollowing: currentId
        ? (obj.followers || []).some((id: any) =>
            new Types.ObjectId(id).equals(currentId),
          )
        : false,
      createdAt: obj.createdAt,
    };
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
