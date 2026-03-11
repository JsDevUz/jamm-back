import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blog, BlogDocument } from './schemas/blog.schema';
import { BlogComment, BlogCommentDocument } from './schemas/blog-comment.schema';
import {
  BlogEngagement,
  BlogEngagementDocument,
} from './schemas/blog-engagement.schema';
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
import {
  generatePrefixedShortSlug,
  isPrefixedShortSlug,
  sanitizePrefixedSlug,
} from '../common/utils/prefixed-slug';

type BlogPayload = {
  title: string;
  markdown: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
};

@Injectable()
export class BlogsService implements OnModuleInit {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<BlogDocument>,
    @InjectModel(BlogComment.name)
    private blogCommentModel: Model<BlogCommentDocument>,
    @InjectModel(BlogEngagement.name)
    private blogEngagementModel: Model<BlogEngagementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private r2Service: R2Service,
  ) {}

  private async resolveUserId(identifier: string) {
    const isJammId = /^\d{5,7}$/.test(identifier);

    if (isJammId) {
      const user = await this.userModel
        .findOne({ jammId: Number(identifier) })
        .select('_id')
        .lean()
        .exec();

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

  private async countUserComments(blogId: string, userId: string) {
    return this.blogCommentModel.countDocuments({
      blogId: new Types.ObjectId(blogId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
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

  private collectManagedAssetUrls(
    markdown: string,
    coverImage?: string,
    markdownUrl?: string,
  ) {
    return Array.from(
      new Set([markdownUrl, coverImage, ...this.extractMarkdownImageUrls(markdown)]),
    ).filter(
      (url): url is string =>
        typeof url === 'string' && this.r2Service.isManagedFile(url),
    );
  }

  private isShortSlug(value?: string | null) {
    return isPrefixedShortSlug(value, ':');
  }

  private async generateUniqueBlogSlug(
    preferredSlug?: string,
    excludeBlogId?: string,
  ) {
    const normalizedPreferred = sanitizePrefixedSlug(preferredSlug, ':');

    if (normalizedPreferred && this.isShortSlug(normalizedPreferred)) {
      const existingPreferred = await this.blogModel
        .findOne({
          slug: normalizedPreferred,
          ...(excludeBlogId
            ? { _id: { $ne: new Types.ObjectId(excludeBlogId) } }
            : {}),
        })
        .select('_id')
        .lean()
        .exec();

      if (!existingPreferred) {
        return normalizedPreferred;
      }
    }

    while (true) {
      const slug = generatePrefixedShortSlug(':', 8);
      const existing = await this.blogModel
        .findOne({
          slug,
          ...(excludeBlogId
            ? { _id: { $ne: new Types.ObjectId(excludeBlogId) } }
            : {}),
        })
        .select('_id')
        .lean()
        .exec();

      if (!existing) {
        return slug;
      }
    }
  }

  async onModuleInit() {
    const blogs = await this.blogModel.find({}).select('_id slug').exec();
    const seenSlugs = new Set<string>();
    let shouldSave = false;

    for (const blog of blogs) {
      const currentSlug = String(blog.slug || '').trim().toLowerCase();
      const normalizedSlug = sanitizePrefixedSlug(currentSlug, ':');
      const slugIsReusable =
        this.isShortSlug(normalizedSlug) && !seenSlugs.has(normalizedSlug);

      if (!slugIsReusable) {
        blog.slug = await this.generateUniqueBlogSlug(undefined, blog._id.toString());
        shouldSave = true;
      }

      seenSlugs.add(String(blog.slug));
    }

    if (shouldSave) {
      await Promise.all(blogs.map((blog) => blog.save()));
    }
  }

  private async getEngagementMap(blogIds: string[], currentUserId?: string) {
    if (!currentUserId || !blogIds.length) {
      return new Map<string, { liked: boolean; viewed: boolean }>();
    }

    const engagements = await this.blogEngagementModel
      .find({
        blogId: { $in: blogIds.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(currentUserId),
      })
      .select('blogId liked viewed')
      .lean()
      .exec();

    return new Map(
      engagements.map((item) => [
        String(item.blogId),
        {
          liked: Boolean(item.liked),
          viewed: Boolean(item.viewed),
        },
      ]),
    );
  }

  private formatBlog(
    blog: any,
    engagementMap?: Map<string, { liked: boolean; viewed: boolean }>,
  ) {
    const obj = typeof blog.toObject === 'function' ? blog.toObject() : blog;
    const engagement = engagementMap?.get(String(obj._id));

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
      likes: Number(obj.likesCount || 0),
      liked: Boolean(engagement?.liked),
      views: Number(obj.viewsCount || 0),
      previouslySeen: Boolean(engagement?.viewed),
      comments: Number(obj.commentsCount || 0),
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
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .exec();

    if (!blog) {
      throw new NotFoundException('Blog topilmadi');
    }

    return blog;
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

    const slug = await this.generateUniqueBlogSlug();

    const blog = await this.blogModel.create({
      author: new Types.ObjectId(userId),
      title: payload.title.trim(),
      slug,
      excerpt: this.buildExcerpt(payload.markdown, payload.excerpt),
      coverImage: (payload.coverImage || '').trim(),
      markdownUrl: 'pending',
      tags: this.normalizeTags(payload.tags),
      likesCount: 0,
      viewsCount: 0,
      commentsCount: 0,
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
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatBlog(populated);
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

    const markdownKey = this.buildMarkdownKey(userId, blog._id.toString());
    const markdownUrl = await this.r2Service.uploadBuffer(
      Buffer.from(payload.markdown, 'utf-8'),
      markdownKey,
      'text/markdown; charset=utf-8',
    );

    blog.title = payload.title.trim();
    blog.slug = blog.slug || (await this.generateUniqueBlogSlug(undefined, blog._id.toString()));
    blog.excerpt = this.buildExcerpt(payload.markdown, payload.excerpt);
    blog.coverImage = (payload.coverImage || '').trim();
    blog.tags = this.normalizeTags(payload.tags);
    blog.markdownUrl = markdownUrl;
    await blog.save();

    const nextAssets = new Set(
      this.collectManagedAssetUrls(payload.markdown, payload.coverImage, markdownUrl),
    );
    const removedAssets = previousAssets.filter((assetUrl) => !nextAssets.has(assetUrl));

    await Promise.allSettled(
      removedAssets.map((assetUrl) => this.r2Service.deleteFile(assetUrl)),
    );

    const updated = await this.blogModel
      .findById(blog._id)
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatBlog(updated);
  }

  async getUserBlogs(identifier: string, currentUserId?: string) {
    const authorId = await this.resolveUserId(identifier);
    if (!authorId) return [];

    const blogs = await this.blogModel
      .find({ author: authorId, isDeleted: false })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      blogs.map((blog) => String(blog._id)),
      currentUserId,
    );

    return blogs.map((blog) => this.formatBlog(blog, engagementMap));
  }

  async getLikedBlogs(userId: string) {
    const engagements = await this.blogEngagementModel
      .find({ userId: new Types.ObjectId(userId), liked: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean()
      .exec();

    const blogIds = engagements.map((item) => item.blogId);
    if (!blogIds.length) return [];

    const blogs = await this.blogModel
      .find({ _id: { $in: blogIds }, isDeleted: false })
      .sort({ updatedAt: -1, publishedAt: -1, createdAt: -1 })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      blogs.map((blog) => String(blog._id)),
      userId,
    );
    const blogMap = new Map(blogs.map((blog) => [String(blog._id), blog]));

    return blogIds
      .map((blogId) => blogMap.get(String(blogId)))
      .filter(Boolean)
      .map((blog) => this.formatBlog(blog, engagementMap));
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
        .populate(
          'author',
          'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
        )
        .lean()
        .exec(),
      this.blogModel.countDocuments({ isDeleted: false }),
    ]);

    const engagementMap = await this.getEngagementMap(
      blogs.map((blog) => String(blog._id)),
      currentUserId,
    );

    return {
      data: blogs.map((blog) => this.formatBlog(blog, engagementMap)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getBlog(identifier: string, currentUserId?: string) {
    const blog = await this.resolveBlog(identifier);
    const engagementMap = await this.getEngagementMap(
      [String(blog._id)],
      currentUserId,
    );
    return this.formatBlog(blog, engagementMap);
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
    const existing = await this.blogEngagementModel.findOne({
      blogId: blog._id,
      userId: new Types.ObjectId(userId),
    });
    const nextLiked = !existing?.liked;

    await this.blogEngagementModel.findOneAndUpdate(
      { blogId: blog._id, userId: new Types.ObjectId(userId) },
      { $set: { liked: nextLiked } },
      { upsert: true, new: true },
    );
    await this.blogModel
      .updateOne({ _id: blog._id }, { $inc: { likesCount: nextLiked ? 1 : -1 } })
      .exec();

    const refreshed = await this.blogModel.findById(blog._id).select('likesCount').lean();
    return {
      liked: nextLiked,
      likes: Number(refreshed?.likesCount || 0),
    };
  }

  async viewBlog(identifier: string, userId: string) {
    const blog = await this.resolveBlog(identifier);
    const existing = await this.blogEngagementModel
      .findOne({
        blogId: blog._id,
        userId: new Types.ObjectId(userId),
      })
      .select('viewed')
      .lean()
      .exec();

    if (!existing?.viewed) {
      await this.blogEngagementModel.findOneAndUpdate(
        { blogId: blog._id, userId: new Types.ObjectId(userId) },
        { $set: { viewed: true } },
        { upsert: true, new: true },
      );
      await this.blogModel
        .updateOne({ _id: blog._id }, { $inc: { viewsCount: 1 } })
        .exec();
    }

    const refreshed = await this.blogModel.findById(blog._id).select('viewsCount').lean();
    return { views: Number(refreshed?.viewsCount || 0) };
  }

  async addComment(identifier: string, userId: string, content: string) {
    const blog = await this.resolveBlog(identifier);

    if (!content?.trim()) {
      throw new BadRequestException('Izoh bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Blog izohi', content.trim(), APP_TEXT_LIMITS.blogCommentChars);
    const limits = await this.getBlogLimits(userId);
    if ((await this.countUserComments(blog._id.toString(), userId)) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu blog uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    await this.blogCommentModel.create({
      blogId: blog._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: null,
      content: content.trim(),
    });
    await this.blogModel
      .updateOne({ _id: blog._id }, { $inc: { commentsCount: 1 } })
      .exec();

    const refreshed = await this.blogModel.findById(blog._id).select('commentsCount').lean();
    return { comments: Number(refreshed?.commentsCount || 0) };
  }

  async addReply(
    identifier: string,
    commentId: string,
    userId: string,
    content: string,
    replyToUser?: string,
  ) {
    const blog = await this.resolveBlog(identifier);

    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Izoh identifikatori noto‘g‘ri');
    }

    if (!content?.trim()) {
      throw new BadRequestException('Javob bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Blog javobi', content.trim(), APP_TEXT_LIMITS.blogCommentChars);

    const parentComment = await this.blogCommentModel
      .findOne({
        _id: new Types.ObjectId(commentId),
        blogId: blog._id,
        parentCommentId: null,
        isDeleted: false,
      })
      .lean()
      .exec();

    if (!parentComment) {
      throw new NotFoundException('Izoh topilmadi');
    }

    const limits = await this.getBlogLimits(userId);
    if ((await this.countUserComments(blog._id.toString(), userId)) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu blog uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    await this.blogCommentModel.create({
      blogId: blog._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: parentComment._id,
      content: content.trim(),
      replyToUser: replyToUser || '',
    });
    await this.blogModel
      .updateOne({ _id: blog._id }, { $inc: { commentsCount: 1 } })
      .exec();

    const replies = await this.blogCommentModel.countDocuments({
      parentCommentId: parentComment._id,
      isDeleted: false,
    });
    return { replies };
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
      .select('_id')
      .lean()
      .exec();

    if (!blog) {
      throw new NotFoundException('Blog topilmadi');
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [comments, total] = await Promise.all([
      this.blogCommentModel
        .find({
          blogId: blog._id,
          parentCommentId: null,
          isDeleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.blogCommentModel.countDocuments({
        blogId: blog._id,
        parentCommentId: null,
        isDeleted: false,
      }),
    ]);

    const replies = await this.blogCommentModel
      .find({
        blogId: blog._id,
        parentCommentId: { $in: comments.map((comment) => comment._id) },
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
        content: reply.content,
        replyToUser: reply.replyToUser || '',
        createdAt: reply.createdAt,
      });
    }

    return {
      data: comments.map((comment) => ({
        _id: comment._id,
        user: usersMap.get(String(comment.userId)) || comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
        replies: repliesMap.get(String(comment._id)) || [],
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
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

    blog.isDeleted = true;
    blog.likesCount = 0;
    blog.viewsCount = 0;
    blog.commentsCount = 0;
    await blog.save();

    await Promise.all([
      this.blogCommentModel.deleteMany({ blogId: blog._id }).exec(),
      this.blogEngagementModel.deleteMany({ blogId: blog._id }).exec(),
    ]);

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
