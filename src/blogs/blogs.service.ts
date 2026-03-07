import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blog, BlogDocument } from './schemas/blog.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  countMarkdownImages,
  countWords,
  getTierLimit,
} from '../common/limits/app-limits';

type BlogPayload = {
  title: string;
  markdown: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
};

@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<BlogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private r2Service: R2Service,
  ) {}

  private async resolveUserId(identifier: string) {
    const isJammId = /^\d{5,7}$/.test(identifier);

    if (isJammId) {
      const user = await this.userModel
        .findOne({ jammId: Number(identifier) })
        .select('_id');

      return user?._id || null;
    }

    if (Types.ObjectId.isValid(identifier)) {
      return new Types.ObjectId(identifier);
    }

    return null;
  }

  private normalizeTags(tags?: string[]) {
    return (tags || [])
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => {
        assertMaxChars('Blog tegi', tag, APP_TEXT_LIMITS.blogTagChars);
        return tag;
      })
      .slice(0, 8);
  }

  private stripMarkdown(markdown: string) {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/[#>*_`~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildExcerpt(markdown: string, excerpt?: string) {
    const base = (excerpt || '').trim() || this.stripMarkdown(markdown);
    return base.slice(0, 220).trim();
  }

  private async getBlogLimits(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus')
      .lean()
      .exec();

    return {
      blogCount: getTierLimit(APP_LIMITS.blogsPerUser, user?.premiumStatus),
      commentCount: getTierLimit(
        APP_LIMITS.blogCommentsPerBlog,
        user?.premiumStatus,
      ),
      imageCount: getTierLimit(
        APP_LIMITS.blogImagesPerBlog,
        user?.premiumStatus,
      ),
      wordCount: getTierLimit(APP_LIMITS.blogWords, user?.premiumStatus),
    };
  }

  private countUserComments(blog: any, userId: string) {
    return Array.isArray(blog.comments)
      ? blog.comments.reduce((total: number, comment: any) => {
          const ownComment = comment.userId?.toString() === userId ? 1 : 0;
          const ownReplies = Array.isArray(comment.replies)
            ? comment.replies.filter(
                (reply: any) => reply.userId?.toString() === userId,
              ).length
            : 0;
          return total + ownComment + ownReplies;
        }, 0)
      : 0;
  }

  private validateBlogPayload(
    payload: BlogPayload,
    limits: { imageCount: number; wordCount: number },
  ) {
    assertMaxChars('Blog sarlavhasi', payload.title, APP_TEXT_LIMITS.blogTitleChars);
    assertMaxChars(
      'Qisqa tavsif',
      payload.excerpt,
      APP_TEXT_LIMITS.blogExcerptChars,
    );

    const markdownWordCount = countWords(payload.markdown);
    if (markdownWordCount > limits.wordCount) {
      throw new BadRequestException(
        `Blog matni maksimal ${limits.wordCount} ta so'zdan oshmasligi kerak`,
      );
    }

    const totalImages =
      countMarkdownImages(payload.markdown) + (payload.coverImage ? 1 : 0);
    if (totalImages > limits.imageCount) {
      throw new BadRequestException(
        `Har bir blog uchun maksimal ${limits.imageCount} ta rasm ishlatish mumkin`,
      );
    }
  }

  private buildMarkdownKey(userId: string, blogId: string) {
    return `blogs/markdown/${userId}/${blogId}.md`;
  }

  private extractMarkdownImageUrls(markdown: string) {
    const matches = String(markdown || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g);
    return Array.from(matches, (match) => String(match[1] || '').trim()).filter(
      Boolean,
    );
  }

  private collectManagedAssetUrls(markdown: string, coverImage?: string, markdownUrl?: string) {
    return Array.from(
      new Set([
        markdownUrl,
        coverImage,
        ...this.extractMarkdownImageUrls(markdown),
      ]),
    ).filter(
      (url): url is string =>
        typeof url === 'string' && this.r2Service.isManagedFile(url),
    );
  }

  private async buildUniqueSlug(title: string, excludeBlogId?: string) {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'blog';

    let slug = base;
    let suffix = 1;

    while (true) {
      const existing = await this.blogModel.findOne({
        slug,
        isDeleted: false,
        ...(excludeBlogId
          ? { _id: { $ne: new Types.ObjectId(excludeBlogId) } }
          : {}),
      });

      if (!existing) return slug;

      suffix += 1;
      slug = `${base}-${suffix}`;
    }
  }

  private formatBlog(blog: any, currentUserId?: string) {
    const obj = typeof blog.toObject === 'function' ? blog.toObject() : blog;

    return {
      _id: obj._id,
      title: obj.title,
      slug: obj.slug,
      excerpt: obj.excerpt,
      coverImage: obj.coverImage,
      markdownUrl: obj.markdownUrl,
      tags: obj.tags || [],
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
      likes: obj.likes?.length || 0,
      liked: currentUserId
        ? (obj.likes || []).some(
            (id: any) => id.toString() === currentUserId.toString(),
          )
        : false,
      views: obj.views?.length || 0,
      comments: obj.comments?.length || 0,
      publishedAt: obj.publishedAt,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  private async resolveBlog(identifier: string) {
    const filter =
      Types.ObjectId.isValid(identifier) && identifier.length === 24
        ? { _id: new Types.ObjectId(identifier) }
        : { slug: identifier };

    const blog = await this.blogModel
      .findOne({ ...filter, isDeleted: false })
      .populate('author', 'username nickname avatar premiumStatus jammId');

    if (!blog) {
      throw new NotFoundException('Blog topilmadi');
    }

    return blog;
  }

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Rasm topilmadi');
    }

    return {
      url: await this.r2Service.uploadFile(file, 'blogs/images'),
    };
  }

  async createBlog(userId: string, payload: BlogPayload) {
    if (!payload.title?.trim()) {
      throw new BadRequestException('Sarlavha majburiy');
    }

    if (!payload.markdown?.trim()) {
      throw new BadRequestException('Blog matni majburiy');
    }

    const limits = await this.getBlogLimits(userId);
    const currentCount = await this.blogModel.countDocuments({
      author: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (currentCount >= limits.blogCount) {
      throw new ForbiddenException(
        `Siz maksimal ${limits.blogCount} ta blog yarata olasiz`,
      );
    }

    this.validateBlogPayload(payload, limits);

    const slug = await this.buildUniqueSlug(payload.title);

    const blog = await this.blogModel.create({
      author: new Types.ObjectId(userId),
      title: payload.title.trim(),
      slug,
      excerpt: this.buildExcerpt(payload.markdown, payload.excerpt),
      coverImage: (payload.coverImage || '').trim(),
      markdownUrl: 'pending',
      tags: this.normalizeTags(payload.tags),
    });

    const markdownKey = this.buildMarkdownKey(userId, blog._id.toString());
    const markdownUrl = await this.r2Service.uploadBuffer(
      Buffer.from(payload.markdown, 'utf-8'),
      markdownKey,
      'text/markdown; charset=utf-8',
    );

    blog.markdownUrl = markdownUrl;
    await blog.save();

    const populated = await this.blogModel
      .findById(blog._id)
      .populate('author', 'username nickname avatar premiumStatus jammId');

    return this.formatBlog(populated, userId);
  }

  async updateBlog(blogId: string, userId: string, payload: BlogPayload) {
    const blog = await this.resolveBlog(blogId);

    if (blog.author._id.toString() !== userId.toString()) {
      throw new ForbiddenException('Faqat muallif tahrirlashi mumkin');
    }

    if (!payload.title?.trim()) {
      throw new BadRequestException('Sarlavha majburiy');
    }

    if (!payload.markdown?.trim()) {
      throw new BadRequestException('Blog matni majburiy');
    }

    const limits = await this.getBlogLimits(userId);
    this.validateBlogPayload(payload, limits);

    let previousMarkdownContent = '';
    try {
      previousMarkdownContent = await this.r2Service.getFileText(blog.markdownUrl);
    } catch (error) {
      console.error('Failed to read previous blog markdown before update:', error);
    }

    const previousAssets = this.collectManagedAssetUrls(
      previousMarkdownContent,
      blog.coverImage,
      blog.markdownUrl,
    );

    const nextSlug =
      payload.title.trim() !== blog.title
        ? await this.buildUniqueSlug(payload.title, blog._id.toString())
        : blog.slug;

    const markdownKey = this.buildMarkdownKey(userId, blog._id.toString());
    const markdownUrl = await this.r2Service.uploadBuffer(
      Buffer.from(payload.markdown, 'utf-8'),
      markdownKey,
      'text/markdown; charset=utf-8',
    );

    blog.title = payload.title.trim();
    blog.slug = nextSlug;
    blog.excerpt = this.buildExcerpt(payload.markdown, payload.excerpt);
    blog.coverImage = (payload.coverImage || '').trim();
    blog.tags = this.normalizeTags(payload.tags);
    blog.markdownUrl = markdownUrl;
    await blog.save();

    const nextAssets = new Set(
      this.collectManagedAssetUrls(
        payload.markdown,
        payload.coverImage,
        markdownUrl,
      ),
    );
    const removedAssets = previousAssets.filter((assetUrl) => !nextAssets.has(assetUrl));

    await Promise.allSettled(
      removedAssets.map((assetUrl) => this.r2Service.deleteFile(assetUrl)),
    );

    const updated = await this.blogModel
      .findById(blog._id)
      .populate('author', 'username nickname avatar premiumStatus jammId');

    return this.formatBlog(updated, userId);
  }

  async getUserBlogs(identifier: string, currentUserId?: string) {
    const authorId = await this.resolveUserId(identifier);

    if (!authorId) {
      return [];
    }

    const blogs = await this.blogModel
      .find({ author: authorId, isDeleted: false })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('author', 'username nickname avatar premiumStatus jammId');

    return blogs.map((blog) => this.formatBlog(blog, currentUserId));
  }

  async getLikedBlogs(userId: string) {
    const blogs = await this.blogModel
      .find({
        isDeleted: false,
        likes: new Types.ObjectId(userId),
      })
      .sort({ updatedAt: -1, publishedAt: -1, createdAt: -1 })
      .limit(50)
      .populate('author', 'username nickname avatar premiumStatus jammId');

    return blogs.map((blog) => this.formatBlog(blog, userId));
  }

  async getLatestBlogs(
    currentUserId?: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 20 },
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [blogs, total] = await Promise.all([
      this.blogModel
        .find({ isDeleted: false })
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .populate('author', 'username nickname avatar premiumStatus jammId'),
      this.blogModel.countDocuments({ isDeleted: false }),
    ]);

    return {
      data: blogs.map((blog) => this.formatBlog(blog, currentUserId)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getBlog(identifier: string, currentUserId?: string) {
    const blog = await this.resolveBlog(identifier);
    return this.formatBlog(blog, currentUserId);
  }

  async getBlogContent(identifier: string) {
    const blog = await this.resolveBlog(identifier);
    const content = await this.r2Service.getFileText(blog.markdownUrl);

    return {
      content,
      markdownUrl: blog.markdownUrl,
    };
  }

  async likeBlog(identifier: string, userId: string) {
    const blog = await this.resolveBlog(identifier);
    const uid = new Types.ObjectId(userId);
    const alreadyLiked = blog.likes.some((id) => id.equals(uid));

    if (alreadyLiked) {
      blog.likes = blog.likes.filter((id) => !id.equals(uid));
    } else {
      blog.likes.push(uid);
    }

    await blog.save();

    return {
      liked: !alreadyLiked,
      likes: blog.likes.length,
    };
  }

  async viewBlog(identifier: string, userId: string) {
    const blog = await this.resolveBlog(identifier);
    const uid = new Types.ObjectId(userId);

    if (!blog.views.some((id) => id.equals(uid))) {
      blog.views.push(uid);
      await blog.save();
    }

    return { views: blog.views.length };
  }

  async addComment(identifier: string, userId: string, content: string) {
    const blog = await this.resolveBlog(identifier);

    if (!content?.trim()) {
      throw new BadRequestException('Izoh bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Blog izohi', content.trim(), APP_TEXT_LIMITS.blogCommentChars);
    const limits = await this.getBlogLimits(userId);
    if (this.countUserComments(blog, userId) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu blog uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    blog.comments.push({
      userId: new Types.ObjectId(userId),
      content: content.trim(),
      createdAt: new Date(),
      replies: [],
    } as any);

    await blog.save();

    return { comments: blog.comments.length };
  }

  async addReply(
    identifier: string,
    commentId: string,
    userId: string,
    content: string,
    replyToUser?: string,
  ) {
    const blog = await this.resolveBlog(identifier);

    if (!content?.trim()) {
      throw new BadRequestException('Javob bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Blog javobi', content.trim(), APP_TEXT_LIMITS.blogCommentChars);

    const commentIndex = blog.comments.findIndex(
      (comment: any) => comment._id.toString() === commentId,
    );

    if (commentIndex === -1) {
      throw new NotFoundException('Izoh topilmadi');
    }

    const limits = await this.getBlogLimits(userId);
    if (this.countUserComments(blog, userId) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu blog uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    if (!blog.comments[commentIndex].replies) {
      blog.comments[commentIndex].replies = [];
    }

    blog.comments[commentIndex].replies.push({
      userId: new Types.ObjectId(userId),
      content: content.trim(),
      replyToUser: replyToUser || '',
      createdAt: new Date(),
    } as any);

    await blog.save();

    return {
      replies: blog.comments[commentIndex].replies?.length || 0,
    };
  }

  async getComments(
    identifier: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ) {
    const blog = await this.blogModel
      .findOne({
        ...(Types.ObjectId.isValid(identifier) && identifier.length === 24
          ? { _id: new Types.ObjectId(identifier) }
          : { slug: identifier }),
        isDeleted: false,
      })
      .populate('comments.userId', 'username nickname avatar premiumStatus')
      .populate(
        'comments.replies.userId',
        'username nickname avatar premiumStatus',
      );

    if (!blog) {
      throw new NotFoundException('Blog topilmadi');
    }

    const allComments = [...(blog.comments || [])].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const skip = (pagination.page - 1) * pagination.limit;
    const paginatedComments = allComments.slice(skip, skip + pagination.limit);

    return {
      data: paginatedComments.map((comment: any) => ({
        _id: comment._id,
        user: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
        replies: (comment.replies || []).map((reply: any) => ({
          _id: reply._id,
          user: reply.userId,
          content: reply.content,
          replyToUser: reply.replyToUser,
          createdAt: reply.createdAt,
        })),
      })),
      total: allComments.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(allComments.length / pagination.limit),
    };
  }

  async deleteBlog(identifier: string, userId: string) {
    const blog = await this.resolveBlog(identifier);

    if (blog.author._id.toString() !== userId.toString()) {
      throw new ForbiddenException("Faqat muallif o'chirishi mumkin");
    }

    let markdownContent = '';
    try {
      markdownContent = await this.r2Service.getFileText(blog.markdownUrl);
    } catch (error) {
      console.error('Failed to read blog markdown before deletion:', error);
    }

    blog.comments = [];
    blog.isDeleted = true;
    await blog.save();

    const assetUrls = this.collectManagedAssetUrls(
      markdownContent,
      blog.coverImage,
      blog.markdownUrl,
    );

    await Promise.allSettled(
      assetUrls.map((assetUrl) => this.r2Service.deleteFile(assetUrl)),
    );

    return { deleted: true };
  }
}
