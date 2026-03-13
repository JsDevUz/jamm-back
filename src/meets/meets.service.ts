import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meet, MeetDocument } from './schemas/meet.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  getTierLimit,
} from '../common/limits/app-limits';

@Injectable()
export class MeetsService {
  constructor(
    @InjectModel(Meet.name) private meetModel: Model<MeetDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(data: {
    roomId: string;
    title: string;
    isPrivate: boolean;
    creator: string;
  }): Promise<Meet> {
    assertMaxChars('Meet nomi', data.title, APP_TEXT_LIMITS.meetTitleChars);

    const existingMeet = await this.meetModel.exists({ roomId: data.roomId });
    if (existingMeet) {
      throw new ConflictException('Bu room ID allaqachon band');
    }

    const user = await this.userModel
      .findById(data.creator)
      .select('premiumStatus')
      .lean()
      .exec();
    const limit = getTierLimit(APP_LIMITS.meetsCreated, user?.premiumStatus);
    const currentCount = await this.meetModel.countDocuments({
      creator: new Types.ObjectId(data.creator),
    });
    if (currentCount >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta video meet yarata olasiz`,
      );
    }

    const meet = new this.meetModel(data);
    return meet.save();
  }

  async findByCreator(userId: string): Promise<any[]> {
    const meets = await this.meetModel
      .find({ creator: userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return meets.map((m: any) => ({
      _id: m._id,
      roomId: m.roomId,
      title: m.title,
      creator: m.creator,
      isPrivate: m.isPrivate,
      createdAt: m.createdAt,
    }));
  }

  async remove(roomId: string, userId: string): Promise<void> {
    const result = await this.meetModel
      .deleteOne({ roomId, creator: userId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Meet not found or unauthorized');
    }
  }
}
