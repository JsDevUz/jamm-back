import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
    return this.userModel
      .findByIdAndUpdate(userId, { $set: data }, { new: true })
      .select('-password')
      .exec();
  }
}
