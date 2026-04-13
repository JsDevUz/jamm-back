import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meet, MeetDocument } from './schemas/meet.schema.js';
import { APP_TEXT_LIMITS, assertMaxChars } from '../common/limits/app-limits';

@Injectable()
export class MeetsService {
  constructor(
    @InjectModel(Meet.name) private meetModel: Model<MeetDocument>,
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

    const currentCount = await this.meetModel.countDocuments({
      creator: new Types.ObjectId(data.creator),
    });
    if (currentCount >= 1) {
      throw new ForbiddenException('Sizda allaqachon faol meet mavjud');
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

  async findByRoomId(roomId: string): Promise<Meet | null> {
    return this.meetModel.findOne({ roomId }).exec();
  }

  async findPublicByRoomId(roomId: string): Promise<any | null> {
    const meet = (await this.meetModel
      .findOne({ roomId })
      .lean()
      .exec()) as any | null;

    if (!meet) {
      return null;
    }

    return {
      _id: meet._id,
      roomId: meet.roomId,
      title: meet.title,
      creator: meet.creator,
      isPrivate: meet.isPrivate,
      createdAt: meet.createdAt,
    };
  }

  async remove(roomId: string, userId: string): Promise<void> {
    const result = await this.meetModel
      .deleteOne({ roomId, creator: userId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Meet not found or unauthorized');
    }
  }

  async updatePrivacy(
    roomId: string,
    userId: string,
    isPrivate: boolean,
  ): Promise<Meet> {
    const meet = await this.meetModel
      .findOneAndUpdate(
        { roomId, creator: new Types.ObjectId(userId) },
        { $set: { isPrivate } },
        { new: true },
      )
      .exec();

    if (!meet) {
      throw new NotFoundException('Meet not found or unauthorized');
    }

    return meet;
  }
}
