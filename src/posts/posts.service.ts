import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { PostComment, PostCommentDocument } from './schemas/post-comment.schema';
import {
  PostEngagement,
  PostEngagementDocument,
} from './schemas/post-engagement.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import {
  ServerEncryptionStrategy,
  EncryptionType,
} from '../common/encryption/encryption.strategies';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  assertMaxWords,
  getTierLimit,
  startOfCurrentDay,
} from '../common/limits/app-limits';

@Injectable()
export class PostsService {
  private encryptionStrategy: ServerEncryptionStrategy;

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(PostComment.name)
    private postCommentModel: Model<PostCommentDocument>,
    @InjectModel(PostEngagement.name)
    private postEngagementModel: Model<PostEngagementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
  ) {
    this.encryptionStrategy = new ServerEncryptionStrategy(
      this.encryptionService,
    );
  }

  private decryptContent(
    content: string,
    iv?: string,
    authTag?: string,
    keyVersion?: number,
  ) {
    if (!iv || !authTag) {
      return content;
    }

    try {
      return this.encryptionStrategy.decrypt({
        encryptedContent: content,
        iv,
        authTag,
        keyVersion: keyVersion || 0,
      });
    } catch {
      return '[Shifrlangan matn ochilmadi]';
    }
  }

  private async getPostDailyLimit(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus')
      .lean()
      .exec();
    return getTierLimit(APP_LIMITS.postsPerDay, user?.premiumStatus);
  }

  private async getPostCommentLimit(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus')
      .lean()
      .exec();
    return getTierLimit(APP_LIMITS.postCommentsPerPost, user?.premiumStatus);
  }

  private async countUserPostComments(postId: string, userId: string) {
    return this.postCommentModel.countDocuments({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
  }

  private async getEngagementMap(postIds: string[], currentUserId?: string) {
    if (!currentUserId || !postIds.length) {
      return new Map<string, { liked: boolean; viewed: boolean }>();
    }

    const engagements = await this.postEngagementModel
      .find({
        postId: { $in: postIds.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(currentUserId),
      })
      .select('postId liked viewed')
      .lean()
      .exec();

    return new Map(
      engagements.map((item) => [
        String(item.postId),
        {
          liked: Boolean(item.liked),
          viewed: Boolean(item.viewed),
        },
      ]),
    );
  }

  private formatPost(
    post: any,
    engagementMap?: Map<string, { liked: boolean; viewed: boolean }>,
  ) {
    const obj = typeof post?.toObject === 'function' ? post.toObject() : post;
    const engagement = engagementMap?.get(String(obj._id));

    return {
      _id: obj._id,
      author: obj.author
        ? {
            _id: obj.author._id,
            jammId: obj.author.jammId,
            username: obj.author.username,
            nickname: obj.author.nickname,
            avatar: obj.author.avatar,
            premiumStatus: obj.author.premiumStatus,
          }
        : obj.author,
      content: obj.isEncrypted
        ? this.decryptContent(obj.content, obj.iv, obj.authTag, obj.keyVersion)
        : obj.content,
      likes: Number(obj.likesCount || 0),
      liked: Boolean(engagement?.liked),
      views: Number(obj.viewsCount || 0),
      previouslySeen: Boolean(engagement?.viewed),
      comments: Number(obj.commentsCount || 0),
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  private async resolveCommentUsers(comments: any[]) {
    const userIds = Array.from(
      new Set(
        comments
          .map((comment) => String(comment.userId || ''))
          .filter(Boolean),
      ),
    );
    if (!userIds.length) {
      return new Map<string, any>();
    }

    const users = await this.userModel
      .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .select(
        'username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return new Map(users.map((user) => [String(user._id), user]));
  }

  async createPost(userId: string, content: string) {
    if (!String(content || '').trim()) {
      throw new BadRequestException('Post matni bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxWords('Gurung matni', content, APP_TEXT_LIMITS.postWords);

    const dailyLimit = await this.getPostDailyLimit(userId);
    const todayCount = await this.postModel.countDocuments({
      author: new Types.ObjectId(userId),
      isDeleted: false,
      createdAt: { $gte: startOfCurrentDay() },
    });

    if (todayCount >= dailyLimit) {
      throw new ForbiddenException(
        `Siz bir kunda maksimal ${dailyLimit} ta gurung yoza olasiz`,
      );
    }

    const encrypted = this.encryptionStrategy.encrypt(content);

    const post = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptionType: EncryptionType.SERVER,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
      likesCount: 0,
      viewsCount: 0,
      commentsCount: 0,
    });

    const populated = await this.postModel
      .findById(post._id)
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatPost(populated);
  }

  async updatePost(postId: string, userId: string, content: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');
    if (post.author.toString() !== userId) {
      throw new ForbiddenException('Faqat muallif tahrirlashi mumkin');
    }

    if (!String(content || '').trim()) {
      throw new BadRequestException('Post matni bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxWords('Gurung matni', content, APP_TEXT_LIMITS.postWords);

    const encrypted = this.encryptionStrategy.encrypt(content);
    post.content = encrypted.encryptedContent;
    post.iv = encrypted.iv;
    post.authTag = encrypted.authTag;
    post.keyVersion = encrypted.keyVersion;
    post.isEncrypted = true;
    await post.save();

    const populated = await this.postModel
      .findById(post._id)
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatPost(populated);
  }

  async getFeed(
    userId: string,
    type: string = 'foryou',
    pagination: { page: number; limit: number } = { page: 1, limit: 15 },
  ) {
    const filter: any = { isDeleted: false };

    if (type === 'following') {
      const user = await this.userModel.findById(userId).select('following').lean();
      const followingIds = user?.following || [];
      if (!followingIds.length) {
        return { data: [], totalPages: 0, page: 1, limit: pagination.limit };
      }
      filter.author = { $in: followingIds };
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .populate(
          'author',
          'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
        )
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const engagementMap = await this.getEngagementMap(
      posts.map((post) => String(post._id)),
      userId,
    );

    return {
      data: posts.map((post) => this.formatPost(post, engagementMap)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getUserPosts(identifier: string, currentUserId?: string) {
    const isJammId = /^\d{5,7}$/.test(identifier);
    let authorId: Types.ObjectId;

    if (isJammId) {
      const user = await this.userModel
        .findOne({ jammId: Number(identifier) })
        .select('_id')
        .lean()
        .exec();
      if (!user?._id) return [];
      authorId = new Types.ObjectId(user._id);
    } else {
      authorId = new Types.ObjectId(identifier);
    }

    const posts = await this.postModel
      .find({ author: authorId, isDeleted: false })
      .sort({ createdAt: -1 })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      posts.map((post) => String(post._id)),
      currentUserId,
    );

    return posts.map((post) => this.formatPost(post, engagementMap));
  }

  async getLikedPosts(userId: string) {
    const engagements = await this.postEngagementModel
      .find({
        userId: new Types.ObjectId(userId),
        liked: true,
      })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean()
      .exec();

    const postIds = engagements.map((item) => item.postId);
    if (!postIds.length) return [];

    const posts = await this.postModel
      .find({
        _id: { $in: postIds },
        isDeleted: false,
      })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      posts.map((post) => String(post._id)),
      userId,
    );
    const postMap = new Map(posts.map((post) => [String(post._id), post]));

    return postIds
      .map((postId) => postMap.get(String(postId)))
      .filter(Boolean)
      .map((post) => this.formatPost(post, engagementMap));
  }

  async likePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const existing = await this.postEngagementModel.findOne({
      postId: post._id,
      userId: new Types.ObjectId(userId),
    });

    const nextLiked = !existing?.liked;

    await this.postEngagementModel.findOneAndUpdate(
      { postId: post._id, userId: new Types.ObjectId(userId) },
      { $set: { liked: nextLiked } },
      { upsert: true, new: true },
    );

    await this.postModel
      .updateOne({ _id: post._id }, { $inc: { likesCount: nextLiked ? 1 : -1 } })
      .exec();

    const refreshed = await this.postModel.findById(post._id).select('likesCount').lean();

    return {
      liked: nextLiked,
      likes: Number(refreshed?.likesCount || 0),
    };
  }

  async viewPost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId).select('_id isDeleted').lean();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const existing = await this.postEngagementModel
      .findOne({
        postId: post._id,
        userId: new Types.ObjectId(userId),
      })
      .select('viewed')
      .lean()
      .exec();

    if (!existing?.viewed) {
      await this.postEngagementModel.findOneAndUpdate(
        { postId: post._id, userId: new Types.ObjectId(userId) },
        { $set: { viewed: true } },
        { upsert: true, new: true },
      );
      await this.postModel
        .updateOne({ _id: post._id }, { $inc: { viewsCount: 1 } })
        .exec();
    }

    const refreshed = await this.postModel.findById(post._id).select('viewsCount').lean();
    return { views: Number(refreshed?.viewsCount || 0) };
  }

  async addComment(postId: string, userId: string, content: string) {
    const post = await this.postModel.findById(postId).select('_id isDeleted').lean();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');
    if (!String(content || '').trim()) {
      throw new BadRequestException('Izoh bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Gurung izohi', content.trim(), APP_TEXT_LIMITS.postCommentChars);

    const commentLimit = await this.getPostCommentLimit(userId);
    if ((await this.countUserPostComments(postId, userId)) >= commentLimit) {
      throw new ForbiddenException(
        `Bu gurung uchun maksimal ${commentLimit} ta izoh yozishingiz mumkin`,
      );
    }

    const encrypted = this.encryptionStrategy.encrypt(content);
    await this.postCommentModel.create({
      postId: post._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: null,
      content: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
    });

    await this.postModel
      .updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } })
      .exec();
    const refreshed = await this.postModel.findById(post._id).select('commentsCount').lean();
    return { comments: Number(refreshed?.commentsCount || 0) };
  }

  async addReply(
    postId: string,
    commentId: string,
    userId: string,
    content: string,
    replyToUser?: string,
  ) {
    const post = await this.postModel.findById(postId).select('_id isDeleted').lean();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Izoh identifikatori noto‘g‘ri');
    }
    if (!String(content || '').trim()) {
      throw new BadRequestException('Javob bo‘sh bo‘lishi mumkin emas');
    }

    const parentComment = await this.postCommentModel
      .findOne({
        _id: new Types.ObjectId(commentId),
        postId: post._id,
        parentCommentId: null,
        isDeleted: false,
      })
      .lean()
      .exec();

    if (!parentComment) {
      throw new NotFoundException('Izoh topilmadi');
    }

    assertMaxChars(
      'Gurung javobi',
      content.trim(),
      APP_TEXT_LIMITS.postCommentChars,
    );

    const commentLimit = await this.getPostCommentLimit(userId);
    if ((await this.countUserPostComments(postId, userId)) >= commentLimit) {
      throw new ForbiddenException(
        `Bu gurung uchun maksimal ${commentLimit} ta izoh yozishingiz mumkin`,
      );
    }

    const encrypted = this.encryptionStrategy.encrypt(content);
    await this.postCommentModel.create({
      postId: post._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: parentComment._id,
      content: encrypted.encryptedContent,
      replyToUser: replyToUser || '',
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
    });

    await this.postModel
      .updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } })
      .exec();

    const repliesCount = await this.postCommentModel.countDocuments({
      parentCommentId: parentComment._id,
      isDeleted: false,
    });

    return { replies: repliesCount };
  }

  async getComments(
    postId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ) {
    const post = await this.postModel.findById(postId).select('_id isDeleted').lean();
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const skip = (pagination.page - 1) * pagination.limit;
    const [comments, total] = await Promise.all([
      this.postCommentModel
        .find({
          postId: post._id,
          parentCommentId: null,
          isDeleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.postCommentModel.countDocuments({
        postId: post._id,
        parentCommentId: null,
        isDeleted: false,
      }),
    ]);

    const replies = await this.postCommentModel
      .find({
        postId: post._id,
        parentCommentId: {
          $in: comments.map((comment) => comment._id),
        },
        isDeleted: false,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const usersMap = await this.resolveCommentUsers([...comments, ...replies]);
    const repliesMap = new Map<string, any[]>();

    for (const reply of replies) {
      const key = String(reply.parentCommentId);
      if (!repliesMap.has(key)) {
        repliesMap.set(key, []);
      }

      repliesMap.get(key)?.push({
        _id: reply._id,
        user: usersMap.get(String(reply.userId)) || reply.userId,
        content: reply.isEncrypted
          ? this.decryptContent(reply.content, reply.iv, reply.authTag, reply.keyVersion)
          : reply.content,
        replyToUser: reply.replyToUser || '',
        createdAt: reply.createdAt,
      });
    }

    return {
      data: comments.map((comment) => ({
        _id: comment._id,
        user: usersMap.get(String(comment.userId)) || comment.userId,
        content: comment.isEncrypted
          ? this.decryptContent(
              comment.content,
              comment.iv,
              comment.authTag,
              comment.keyVersion,
            )
          : comment.content,
        createdAt: comment.createdAt,
        replies: repliesMap.get(String(comment._id)) || [],
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post topilmadi');
    if (post.author.toString() !== userId) {
      throw new ForbiddenException("Faqat muallif o'chirishi mumkin");
    }

    post.isDeleted = true;
    post.likesCount = 0;
    post.viewsCount = 0;
    post.commentsCount = 0;
    await post.save();

    await Promise.all([
      this.postCommentModel.deleteMany({ postId: post._id }).exec(),
      this.postEngagementModel.deleteMany({ postId: post._id }).exec(),
    ]);

    return { deleted: true };
  }
}
