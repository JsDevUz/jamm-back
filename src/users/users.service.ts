import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

import { R2Service } from '../common/services/r2.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private r2Service: R2Service,
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
    return this.userModel.findOne({ username }).exec();
  }

  async searchUsers(
    query: string,
    currentUserId: string,
  ): Promise<UserDocument[]> {
    if (!query) return [];

    // Create a case-insensitive regular expression for the search query
    const regex = new RegExp(query, 'i');

    // Search for users where username or nickname matches the query,
    // and exclude the current user from the results.
    return this.userModel
      .find({
        _id: { $ne: currentUserId },
        $or: [{ username: regex }, { nickname: regex }],
      })
      .select('-password') // Don't return passwords
      .limit(10) // Limit results for performance
      .exec();
  }
  async updateProfile(
    userId: string,
    data: {
      nickname?: string;
      username?: string;
      phone?: string;
      avatar?: string;
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
}
