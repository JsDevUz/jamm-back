import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meet, MeetDocument } from './schemas/meet.schema.js';

@Injectable()
export class MeetsService {
  constructor(@InjectModel(Meet.name) private meetModel: Model<MeetDocument>) {}

  async create(data: {
    roomId: string;
    title: string;
    isPrivate: boolean;
    creator: string;
  }): Promise<Meet> {
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
