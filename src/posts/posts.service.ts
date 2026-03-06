import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EncryptionService } from '../common/encryption/encryption.service';
import {
  ServerEncryptionStrategy,
  EncryptionType,
} from '../common/encryption/encryption.strategies';

@Injectable()
export class PostsService {
  private encryptionStrategy: ServerEncryptionStrategy;

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
  ) {
    this.encryptionStrategy = new ServerEncryptionStrategy(
      this.encryptionService,
    );
  }

  private decryptPost(post: any): any {
    const obj = post.toObject ? post.toObject() : { ...post };
    if (obj.isEncrypted && obj.iv && obj.authTag) {
      try {
        obj.content = this.encryptionStrategy.decrypt({
          encryptedContent: obj.content,
          iv: obj.iv,
          authTag: obj.authTag,
          keyVersion: obj.keyVersion || 0,
        });
      } catch {
        obj.content = '[Shifrlangan matn ochilmadi]';
      }
    }
    // Decrypt comments and replies
    if (obj.comments && obj.comments.length > 0) {
      obj.comments = obj.comments.map((c: any) => {
        if (c.isEncrypted && c.iv && c.authTag) {
          try {
            c.content = this.encryptionStrategy.decrypt({
              encryptedContent: c.content,
              iv: c.iv,
              authTag: c.authTag,
              keyVersion: c.keyVersion || 0,
            });
          } catch {
            c.content = '[Shifrlangan izoh ochilmadi]';
          }
        }

        // Decrypt replies
        if (c.replies && c.replies.length > 0) {
          c.replies = c.replies.map((r: any) => {
            if (r.isEncrypted && r.iv && r.authTag) {
              try {
                r.content = this.encryptionStrategy.decrypt({
                  encryptedContent: r.content,
                  iv: r.iv,
                  authTag: r.authTag,
                  keyVersion: r.keyVersion || 0,
                });
              } catch {
                r.content = '[Shifrlangan javob ochilmadi]';
              }
            }
            return r;
          });
        }

        return c;
      });
    }
    return obj;
  }

  private formatPost(post: any, currentUserId?: string) {
    const obj = this.decryptPost(post);
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
      content: obj.content,
      likes: obj.likes?.length || 0,
      liked: currentUserId
        ? obj.likes?.some(
            (id: any) => id.toString() === currentUserId.toString(),
          )
        : false,
      views: obj.views?.length || 0,
      comments: obj.comments?.length || 0,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  async createPost(userId: string, content: string) {
    const encrypted = this.encryptionStrategy.encrypt(content);

    const post = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      encryptionType: EncryptionType.SERVER,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
    });

    const populated = await this.postModel
      .findById(post._id)
      .populate('author', 'username nickname avatar premiumStatus');

    return this.formatPost(populated, userId);
  }

  async getFeed(
    userId: string,
    type: string = 'foryou',
    pagination: { page: number; limit: number } = { page: 1, limit: 15 },
  ) {
    let filter: any = { isDeleted: false };

    if (type === 'following') {
      const user = await this.userModel.findById(userId).select('following');
      const followingIds = user?.following || [];
      if (followingIds.length === 0)
        return { data: [], totalPages: 0, page: 1, limit: pagination.limit };
      filter.author = { $in: followingIds };
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .populate('author', 'username nickname avatar premiumStatus'),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data: posts.map((p) => this.formatPost(p, userId)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getUserPosts(identifier: string, currentUserId?: string) {
    // identifier can be jammId (5-7 digit) or MongoDB ObjectId string
    const isJammId = /^\d{5,7}$/.test(identifier);
    let authorId: any;
    if (isJammId) {
      const user = await this.userModel
        .findOne({ jammId: Number(identifier) })
        .select('_id');
      if (!user) return [];
      authorId = user._id;
    } else {
      authorId = new Types.ObjectId(identifier);
    }

    const posts = await this.postModel
      .find({ author: authorId, isDeleted: false })
      .sort({ createdAt: -1 })
      .populate('author', 'username nickname avatar premiumStatus jammId');

    return posts.map((p) => this.formatPost(p, currentUserId));
  }

  async likePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const uid = new Types.ObjectId(userId);
    const alreadyLiked = post.likes.some((id) => id.equals(uid));

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => !id.equals(uid));
    } else {
      post.likes.push(uid);
    }

    await post.save();

    return {
      liked: !alreadyLiked,
      likes: post.likes.length,
    };
  }

  async viewPost(postId: string, userId: string) {
    const uid = new Types.ObjectId(userId);

    await this.postModel.findByIdAndUpdate(postId, {
      $addToSet: { views: uid },
    });

    const post = await this.postModel.findById(postId);
    return { views: post?.views?.length || 0 };
  }

  async addComment(postId: string, userId: string, content: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const encrypted = this.encryptionStrategy.encrypt(content);

    const comment = {
      userId: new Types.ObjectId(userId),
      content: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
      createdAt: new Date(),
      replies: [],
    };

    post.comments.push(comment);
    await post.save();

    return { comments: post.comments.length };
  }

  async addReply(
    postId: string,
    commentId: string,
    userId: string,
    content: string,
    replyToUser?: string,
  ) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const commentIndex = post.comments.findIndex(
      (c: any) => c._id.toString() === commentId,
    );
    if (commentIndex === -1) {
      throw new NotFoundException('Izoh topilmadi');
    }

    const encrypted = this.encryptionStrategy.encrypt(content);

    const reply = {
      userId: new Types.ObjectId(userId),
      content: encrypted.encryptedContent,
      replyToUser: replyToUser || '',
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isEncrypted: true,
      keyVersion: encrypted.keyVersion,
      createdAt: new Date(),
    };

    if (!post.comments[commentIndex].replies) {
      post.comments[commentIndex].replies = [];
    }

    post.comments[commentIndex].replies.push(reply as any);
    await post.save();

    return { replies: post.comments[commentIndex].replies.length };
  }

  async getComments(
    postId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ) {
    const post = await this.postModel
      .findById(postId)
      .populate('comments.userId', 'username nickname avatar premiumStatus')
      .populate(
        'comments.replies.userId',
        'username nickname avatar premiumStatus',
      );

    if (!post || post.isDeleted) throw new NotFoundException('Post topilmadi');

    const decrypted = this.decryptPost(post);
    const allComments = decrypted.comments || [];

    // Sort comments by createdAt descending (newest first)
    allComments.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const skip = (pagination.page - 1) * pagination.limit;
    const paginatedComments = allComments.slice(skip, skip + pagination.limit);

    return {
      data: paginatedComments.map((c: any) => ({
        _id: c._id,
        user: c.userId,
        content: c.content,
        createdAt: c.createdAt,
        replies: (c.replies || []).map((r: any) => ({
          _id: r._id,
          user: r.userId,
          content: r.content,
          replyToUser: r.replyToUser,
          createdAt: r.createdAt,
        })),
      })),
      total: allComments.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(allComments.length / pagination.limit),
    };
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post topilmadi');
    if (post.author.toString() !== userId) {
      throw new ForbiddenException("Faqat muallif o'chirishi mumkin");
    }

    post.isDeleted = true;
    await post.save();

    return { deleted: true };
  }
}
