import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { Chat, ChatDocument } from '../chats/schemas/chat.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import {
  CourseMemberRecord,
  CourseMemberRecordDocument,
} from '../courses/schemas/course-member.schema';
import { PremiumService } from '../premium/premium.service';
import { PromoCode, PromoCodeDocument } from '../premium/schemas/promo-code.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminListDto } from './dto/admin-list.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdateUserInstructorDto } from './dto/update-user-instructor.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseMemberRecord.name)
    private readonly courseMemberRecordModel: Model<CourseMemberRecordDocument>,
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: Model<PromoCodeDocument>,
    private readonly premiumService: PremiumService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  private buildPagination(dto: AdminListDto) {
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(dto.limit) || 20));
    const skip = (page - 1) * limit;
    const sortBy = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder } as Record<string, 1 | -1>;

    return { page, limit, skip, sort };
  }

  async listUsers(dto: AdminListDto) {
    const { page, limit, skip, sort } = this.buildPagination(dto);
    const query: Record<string, any> = {};
    const q = String(dto.q || '').trim();

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [
        { nickname: regex },
        { username: regex },
        { email: regex },
      ];
    }

    if (dto.premiumStatus) {
      query.premiumStatus = dto.premiumStatus;
    }

    if (dto.isBlocked !== undefined) {
      query.isBlocked = dto.isBlocked === 'true';
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .select(
          'nickname username email avatar premiumStatus premiumExpiresAt isBlocked isInstructor createdAt updatedAt jammId',
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);

    return {
      items: await this.appSettingsService.decorateUsersPayload(items as any[]),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listGroups(dto: AdminListDto) {
    const { page, limit, skip, sort } = this.buildPagination(dto);
    const query: Record<string, any> = { isGroup: true };
    const q = String(dto.q || '').trim();

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      this.chatModel
        .find(query)
        .select(
          'name avatar description createdBy members jammId createdAt updatedAt lastMessageAt',
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.chatModel.countDocuments(query),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        membersCount: Array.isArray(item.members) ? item.members.length : 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listCourses(dto: AdminListDto) {
    const { page, limit, skip, sort } = this.buildPagination(dto);
    const query: Record<string, any> = {};
    const q = String(dto.q || '').trim();

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [{ name: regex }, { description: regex }, { urlSlug: regex }];
    }

    if (dto.accessType) {
      query.accessType = dto.accessType;
    }

    const [items, total] = await Promise.all([
      this.courseModel
        .find(query)
        .select(
          'name description image accessType createdBy createdAt updatedAt urlSlug',
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.courseModel.countDocuments(query),
    ]);

    const courseIds = items.map((item) => item._id).filter(Boolean);
    const memberCounts = courseIds.length
      ? await this.courseMemberRecordModel.aggregate([
          {
            $match: {
              courseId: { $in: courseIds.map((id) => new Types.ObjectId(String(id))) },
              status: 'approved',
            },
          },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ])
      : [];
    const memberCountMap = new Map(
      memberCounts.map((item) => [String(item._id), Number(item.count || 0)]),
    );

    return {
      items: items.map((item) => ({
        ...item,
        membersCount: memberCountMap.get(String(item._id)) || 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async listPromoCodes(dto: AdminListDto) {
    const { page, limit, skip, sort } = this.buildPagination(dto);
    const query: Record<string, any> = {};
    const q = String(dto.q || '').trim();

    if (q) {
      const regex = new RegExp(q, 'i');
      query.displayCode = regex;
    }

    if (dto.isActive !== undefined) {
      query.isActive = dto.isActive === 'true';
    }

    const [items, total] = await Promise.all([
      this.promoCodeModel
        .find(query)
        .select(
          'displayCode validFrom validUntil isActive usedCount maxUses createdAt updatedAt',
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.promoCodeModel.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createPromoCode(dto: CreatePromoCodeDto) {
    return this.premiumService.createPromoCode({
      code: dto.code,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
      durationInDays: dto.durationInDays,
      maxUses: dto.maxUses ?? null,
      isActive: dto.isActive,
    });
  }

  async updateUserInstructor(userId: string, dto: UpdateUserInstructorDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { isInstructor: dto.isInstructor } },
        { new: true },
      )
      .select(
        'nickname username email avatar premiumStatus premiumExpiresAt isBlocked isInstructor createdAt updatedAt jammId',
      )
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [decoratedUser] = await this.appSettingsService.decorateUsersPayload([
      user as any,
    ]);

    return decoratedUser;
  }
}
