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
    courseId?: string | null;
    lessonId?: string | null;
  }): Promise<Meet> {
    assertMaxChars('Meet nomi', data.title, APP_TEXT_LIMITS.meetTitleChars);

    const existingMeet = await this.meetModel.findOne({ roomId: data.roomId });
    if (existingMeet) {
      // Idempotent: same creator re-creating the same room is a no-op.
      if (existingMeet.creator.toString() === String(data.creator)) {
        return existingMeet;
      }
      throw new ConflictException('Bu room ID allaqachon band');
    }

    const creatorObjectId = new Types.ObjectId(data.creator);
    // A creator can only have one active meet at a time. Whenever they create
    // a new one, supersede any prior rows — switching lessons or starting a
    // new chat meet should "just work" without forcing them to manually delete
    // the previous one.
    await this.meetModel.deleteMany({ creator: creatorObjectId });

    const meet = new this.meetModel({
      roomId: data.roomId,
      title: data.title,
      isPrivate: data.isPrivate,
      creator: data.creator,
      courseId: data.courseId ? new Types.ObjectId(data.courseId) : null,
      lessonId: data.lessonId || null,
    });
    return meet.save();
  }

  /** Returns lesson binding for a roomId (used by video gateway for auto-attendance). */
  async getLessonBinding(
    roomId: string,
  ): Promise<{ courseId: string; lessonId: string } | null> {
    const meet = await this.meetModel
      .findOne({ roomId })
      .select('courseId lessonId')
      .lean()
      .exec();
    if (!meet || !meet.courseId || !meet.lessonId) {
      return null;
    }
    return {
      courseId: meet.courseId.toString(),
      lessonId: meet.lessonId,
    };
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
      courseId: m.courseId ? m.courseId.toString() : null,
      lessonId: m.lessonId || null,
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
      courseId: meet.courseId ? meet.courseId.toString() : null,
      lessonId: meet.lessonId || null,
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
