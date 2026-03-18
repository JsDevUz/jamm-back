import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Article, ArticleDocument } from './schemas/article.schema';
import { ArticleComment, ArticleCommentDocument } from './schemas/article-comment.schema';
import {
  ArticleEngagement,
  ArticleEngagementDocument,
} from './schemas/article-engagement.schema';
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

type ArticlePayload = {
  title: string;
  markdown: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
};

@Injectable()
export class ArticlesService implements OnModuleInit {
  constructor(
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    @InjectModel(ArticleComment.name)
    private articleCommentModel: Model<ArticleCommentDocument>,
    @InjectModel(ArticleEngagement.name)
    private articleEngagementModel: Model<ArticleEngagementDocument>,
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
        assertMaxChars('Article tegi', tag, APP_TEXT_LIMITS.articleTagChars);
        return tag;
      })
      .slice(0, APP_TEXT_LIMITS.articleTagCount);
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
    return base.slice(0, APP_TEXT_LIMITS.articleExcerptChars).trim();
  }

  private async getArticleLimits(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('premiumStatus')
      .lean()
      .exec();

    return {
      articleCount: getTierLimit(APP_LIMITS.articlesPerUser, user?.premiumStatus),
      commentCount: getTierLimit(
        APP_LIMITS.articleCommentsPerArticle,
        user?.premiumStatus,
      ),
      imageCount: getTierLimit(
        APP_LIMITS.articleImagesPerArticle,
        user?.premiumStatus,
      ),
      wordCount: getTierLimit(APP_LIMITS.articleWords, user?.premiumStatus),
    };
  }

  private async countUserComments(articleId: string, userId: string) {
    return this.articleCommentModel.countDocuments({
      articleId: new Types.ObjectId(articleId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
  }

  private validateArticlePayload(
    payload: ArticlePayload,
    limits: { imageCount: number; wordCount: number },
  ) {
    assertMaxChars('Article sarlavhasi', payload.title, APP_TEXT_LIMITS.articleTitleChars);
    assertMaxChars(
      'Qisqa tavsif',
      payload.excerpt,
      APP_TEXT_LIMITS.articleExcerptChars,
    );

    const markdownWordCount = countWords(payload.markdown);
    if (markdownWordCount > limits.wordCount) {
      throw new BadRequestException(
        `Article matni maksimal ${limits.wordCount} ta so'zdan oshmasligi kerak`,
      );
    }

    const totalImages =
      countMarkdownImages(payload.markdown) + (payload.coverImage ? 1 : 0);
    if (totalImages > limits.imageCount) {
      throw new BadRequestException(
        `Har bir article uchun maksimal ${limits.imageCount} ta rasm ishlatish mumkin`,
      );
    }
  }

  private buildMarkdownKey(userId: string, articleId: string) {
    return `articles/markdown/${userId}/${articleId}.md`;
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

  private async generateUniqueArticleSlug(
    preferredSlug?: string,
    excludeArticleId?: string,
  ) {
    const normalizedPreferred = sanitizePrefixedSlug(preferredSlug, ':');

    if (normalizedPreferred && this.isShortSlug(normalizedPreferred)) {
      const existingPreferred = await this.articleModel
        .findOne({
          slug: normalizedPreferred,
          ...(excludeArticleId
            ? { _id: { $ne: new Types.ObjectId(excludeArticleId) } }
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
      const existing = await this.articleModel
        .findOne({
          slug,
          ...(excludeArticleId
            ? { _id: { $ne: new Types.ObjectId(excludeArticleId) } }
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
    const articles = await this.articleModel.find({}).select('_id slug').exec();
    const seenSlugs = new Set<string>();
    let shouldSave = false;

    for (const article of articles) {
      const currentSlug = String(article.slug || '').trim().toLowerCase();
      const normalizedSlug = sanitizePrefixedSlug(currentSlug, ':');
      const slugIsReusable =
        this.isShortSlug(normalizedSlug) && !seenSlugs.has(normalizedSlug);

      if (!slugIsReusable) {
        article.slug = await this.generateUniqueArticleSlug(undefined, article._id.toString());
        shouldSave = true;
      }

      seenSlugs.add(String(article.slug));
    }

    if (shouldSave) {
      await Promise.all(articles.map((article) => article.save()));
    }
  }

  private async getEngagementMap(articleIds: string[], currentUserId?: string) {
    if (!currentUserId || !articleIds.length) {
      return new Map<string, { liked: boolean; viewed: boolean }>();
    }

    const engagements = await this.articleEngagementModel
      .find({
        articleId: { $in: articleIds.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(currentUserId),
      })
      .select('articleId liked viewed')
      .lean()
      .exec();

    return new Map(
      engagements.map((item) => [
        String(item.articleId),
        {
          liked: Boolean(item.liked),
          viewed: Boolean(item.viewed),
        },
      ]),
    );
  }

  private formatArticle(
    article: any,
    engagementMap?: Map<string, { liked: boolean; viewed: boolean }>,
  ) {
    const obj = typeof article.toObject === 'function' ? article.toObject() : article;
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

  private async resolveArticle(identifier: string) {
    const filter =
      Types.ObjectId.isValid(identifier) && identifier.length === 24
        ? { _id: new Types.ObjectId(identifier) }
        : { slug: identifier };

    const article = await this.articleModel
      .findOne({ ...filter, isDeleted: false })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .exec();

    if (!article) {
      throw new NotFoundException('Article topilmadi');
    }

    return article;
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
      url: await this.r2Service.uploadFile(file, 'articles/images'),
    };
  }

  async createArticle(userId: string, payload: ArticlePayload) {
    if (!payload.title?.trim()) {
      throw new BadRequestException('Sarlavha majburiy');
    }

    if (!payload.markdown?.trim()) {
      throw new BadRequestException('Article matni majburiy');
    }

    const limits = await this.getArticleLimits(userId);
    const currentCount = await this.articleModel.countDocuments({
      author: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (currentCount >= limits.articleCount) {
      throw new ForbiddenException(
        `Siz maksimal ${limits.articleCount} ta article yarata olasiz`,
      );
    }

    this.validateArticlePayload(payload, limits);

    const slug = await this.generateUniqueArticleSlug();

    const article = await this.articleModel.create({
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

    const markdownKey = this.buildMarkdownKey(userId, article._id.toString());
    const markdownUrl = await this.r2Service.uploadBuffer(
      Buffer.from(payload.markdown, 'utf-8'),
      markdownKey,
      'text/markdown; charset=utf-8',
    );

    article.markdownUrl = markdownUrl;
    await article.save();

    const populated = await this.articleModel
      .findById(article._id)
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatArticle(populated);
  }

  async updateArticle(articleId: string, userId: string, payload: ArticlePayload) {
    const article = await this.resolveArticle(articleId);

    if (article.author._id.toString() !== userId.toString()) {
      throw new ForbiddenException('Faqat muallif tahrirlashi mumkin');
    }

    if (!payload.title?.trim()) {
      throw new BadRequestException('Sarlavha majburiy');
    }

    if (!payload.markdown?.trim()) {
      throw new BadRequestException('Article matni majburiy');
    }

    const limits = await this.getArticleLimits(userId);
    this.validateArticlePayload(payload, limits);

    let previousMarkdownContent = '';
    try {
      previousMarkdownContent = await this.r2Service.getFileText(article.markdownUrl);
    } catch (error) {
      console.error('Failed to read previous article markdown before update:', error);
    }

    const previousAssets = this.collectManagedAssetUrls(
      previousMarkdownContent,
      article.coverImage,
      article.markdownUrl,
    );

    const markdownKey = this.buildMarkdownKey(userId, article._id.toString());
    const markdownUrl = await this.r2Service.uploadBuffer(
      Buffer.from(payload.markdown, 'utf-8'),
      markdownKey,
      'text/markdown; charset=utf-8',
    );

    article.title = payload.title.trim();
    article.slug = article.slug || (await this.generateUniqueArticleSlug(undefined, article._id.toString()));
    article.excerpt = this.buildExcerpt(payload.markdown, payload.excerpt);
    article.coverImage = (payload.coverImage || '').trim();
    article.tags = this.normalizeTags(payload.tags);
    article.markdownUrl = markdownUrl;
    await article.save();

    const nextAssets = new Set(
      this.collectManagedAssetUrls(payload.markdown, payload.coverImage, markdownUrl),
    );
    const removedAssets = previousAssets.filter((assetUrl) => !nextAssets.has(assetUrl));

    await Promise.allSettled(
      removedAssets.map((assetUrl) => this.r2Service.deleteFile(assetUrl)),
    );

    const updated = await this.articleModel
      .findById(article._id)
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    return this.formatArticle(updated);
  }

  async getUserArticles(identifier: string, currentUserId?: string) {
    const authorId = await this.resolveUserId(identifier);
    if (!authorId) return [];

    const articles = await this.articleModel
      .find({ author: authorId, isDeleted: false })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      articles.map((article) => String(article._id)),
      currentUserId,
    );

    return articles.map((article) => this.formatArticle(article, engagementMap));
  }

  async getLikedArticles(userId: string) {
    const engagements = await this.articleEngagementModel
      .find({ userId: new Types.ObjectId(userId), liked: true })
      .sort({ updatedAt: -1 })
        .limit(APP_LIMITS.articleLikedPageSize)
      .lean()
      .exec();

    const articleIds = engagements.map((item) => item.articleId);
    if (!articleIds.length) return [];

    const articles = await this.articleModel
      .find({ _id: { $in: articleIds }, isDeleted: false })
      .sort({ updatedAt: -1, publishedAt: -1, createdAt: -1 })
      .populate(
        'author',
        'username nickname avatar premiumStatus jammId selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const engagementMap = await this.getEngagementMap(
      articles.map((article) => String(article._id)),
      userId,
    );
    const articleMap = new Map(articles.map((article) => [String(article._id), article]));

    return articleIds
      .map((articleId) => articleMap.get(String(articleId)))
      .filter(Boolean)
      .map((article) => this.formatArticle(article, engagementMap));
  }

  async getLatestArticles(
    currentUserId?: string,
    pagination: { page: number; limit: number } = {
      page: 1,
      limit: APP_LIMITS.articleFeedPageSize,
    },
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [articles, total] = await Promise.all([
      this.articleModel
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
      this.articleModel.countDocuments({ isDeleted: false }),
    ]);

    const engagementMap = await this.getEngagementMap(
      articles.map((article) => String(article._id)),
      currentUserId,
    );

    return {
      data: articles.map((article) => this.formatArticle(article, engagementMap)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getArticle(identifier: string, currentUserId?: string) {
    const article = await this.resolveArticle(identifier);
    const engagementMap = await this.getEngagementMap(
      [String(article._id)],
      currentUserId,
    );
    return this.formatArticle(article, engagementMap);
  }

  async getArticleContent(identifier: string) {
    const article = await this.resolveArticle(identifier);
    const content = await this.r2Service.getFileText(article.markdownUrl);

    return {
      content,
      markdownUrl: article.markdownUrl,
    };
  }

  async likeArticle(identifier: string, userId: string) {
    const article = await this.resolveArticle(identifier);
    const existing = await this.articleEngagementModel.findOne({
      articleId: article._id,
      userId: new Types.ObjectId(userId),
    });
    const nextLiked = !existing?.liked;

    await this.articleEngagementModel.findOneAndUpdate(
      { articleId: article._id, userId: new Types.ObjectId(userId) },
      { $set: { liked: nextLiked } },
      { upsert: true, new: true },
    );
    await this.articleModel
      .updateOne({ _id: article._id }, { $inc: { likesCount: nextLiked ? 1 : -1 } })
      .exec();

    const refreshed = await this.articleModel.findById(article._id).select('likesCount').lean();
    return {
      liked: nextLiked,
      likes: Number(refreshed?.likesCount || 0),
    };
  }

  async viewArticle(identifier: string, userId: string) {
    const article = await this.resolveArticle(identifier);
    const existing = await this.articleEngagementModel
      .findOne({
        articleId: article._id,
        userId: new Types.ObjectId(userId),
      })
      .select('viewed')
      .lean()
      .exec();

    if (!existing?.viewed) {
      await this.articleEngagementModel.findOneAndUpdate(
        { articleId: article._id, userId: new Types.ObjectId(userId) },
        { $set: { viewed: true } },
        { upsert: true, new: true },
      );
      await this.articleModel
        .updateOne({ _id: article._id }, { $inc: { viewsCount: 1 } })
        .exec();
    }

    const refreshed = await this.articleModel.findById(article._id).select('viewsCount').lean();
    return { views: Number(refreshed?.viewsCount || 0) };
  }

  async addComment(identifier: string, userId: string, content: string) {
    const article = await this.resolveArticle(identifier);

    if (!content?.trim()) {
      throw new BadRequestException('Izoh bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Article izohi', content.trim(), APP_TEXT_LIMITS.articleCommentChars);
    const limits = await this.getArticleLimits(userId);
    if ((await this.countUserComments(article._id.toString(), userId)) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu article uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    await this.articleCommentModel.create({
      articleId: article._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: null,
      content: content.trim(),
    });
    await this.articleModel
      .updateOne({ _id: article._id }, { $inc: { commentsCount: 1 } })
      .exec();

    const refreshed = await this.articleModel.findById(article._id).select('commentsCount').lean();
    return { comments: Number(refreshed?.commentsCount || 0) };
  }

  async addReply(
    identifier: string,
    commentId: string,
    userId: string,
    content: string,
    replyToUser?: string,
  ) {
    const article = await this.resolveArticle(identifier);

    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Izoh identifikatori noto‘g‘ri');
    }

    if (!content?.trim()) {
      throw new BadRequestException('Javob bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars('Article javobi', content.trim(), APP_TEXT_LIMITS.articleCommentChars);

    const parentComment = await this.articleCommentModel
      .findOne({
        _id: new Types.ObjectId(commentId),
        articleId: article._id,
        parentCommentId: null,
        isDeleted: false,
      })
      .lean()
      .exec();

    if (!parentComment) {
      throw new NotFoundException('Izoh topilmadi');
    }

    const limits = await this.getArticleLimits(userId);
    if ((await this.countUserComments(article._id.toString(), userId)) >= limits.commentCount) {
      throw new ForbiddenException(
        `Bu article uchun maksimal ${limits.commentCount} ta izoh yozishingiz mumkin`,
      );
    }

    await this.articleCommentModel.create({
      articleId: article._id,
      userId: new Types.ObjectId(userId),
      parentCommentId: parentComment._id,
      content: content.trim(),
      replyToUser: replyToUser || '',
    });
    await this.articleModel
      .updateOne({ _id: article._id }, { $inc: { commentsCount: 1 } })
      .exec();

    const refreshed = await this.articleModel.findById(article._id).select('commentsCount').lean();
    const replies = await this.articleCommentModel.countDocuments({
      parentCommentId: parentComment._id,
      isDeleted: false,
    });
    return {
      replies,
      comments: Number(refreshed?.commentsCount || 0),
    };
  }

  async updateComment(
    identifier: string,
    commentId: string,
    userId: string,
    content: string,
  ) {
    const article = await this.resolveArticle(identifier);

    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Izoh identifikatori noto‘g‘ri');
    }

    if (!String(content || '').trim()) {
      throw new BadRequestException('Izoh bo‘sh bo‘lishi mumkin emas');
    }

    assertMaxChars(
      'Article izohi',
      content.trim(),
      APP_TEXT_LIMITS.articleCommentChars,
    );

    const comment = await this.articleCommentModel
      .findOne({
        _id: new Types.ObjectId(commentId),
        articleId: article._id,
        isDeleted: false,
      })
      .exec();

    if (!comment) {
      throw new NotFoundException('Izoh topilmadi');
    }

    if (String(comment.userId) !== userId) {
      throw new ForbiddenException(
        "Faqat o'zingizning izohingizni tahrirlashingiz mumkin",
      );
    }

    comment.content = content.trim();
    await comment.save();

    return { updated: true };
  }

  async deleteComment(identifier: string, commentId: string, userId: string) {
    const article = await this.resolveArticle(identifier);

    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Izoh identifikatori noto‘g‘ri');
    }

    const comment = await this.articleCommentModel
      .findOne({
        _id: new Types.ObjectId(commentId),
        articleId: article._id,
        isDeleted: false,
      })
      .lean()
      .exec();

    if (!comment) {
      throw new NotFoundException('Izoh topilmadi');
    }

    if (String(comment.userId) !== userId) {
      throw new ForbiddenException(
        "Faqat o'zingizning izohingizni o'chirishingiz mumkin",
      );
    }

    let deletedCount = 1;

    if (comment.parentCommentId) {
      await this.articleCommentModel.deleteOne({ _id: comment._id }).exec();
    } else {
      const repliesCount = await this.articleCommentModel.countDocuments({
        parentCommentId: comment._id,
        isDeleted: false,
      });
      deletedCount += repliesCount;

      await this.articleCommentModel
        .deleteMany({
          $or: [{ _id: comment._id }, { parentCommentId: comment._id }],
        })
        .exec();
    }

    const refreshed = await this.articleModel
      .findById(article._id)
      .select('commentsCount')
      .lean();
    const nextCommentsCount = Math.max(
      0,
      Number(refreshed?.commentsCount || 0) - deletedCount,
    );

    await this.articleModel
      .updateOne({ _id: article._id }, { commentsCount: nextCommentsCount })
      .exec();

    return { comments: nextCommentsCount };
  }

  async getComments(
    identifier: string,
    pagination: { page: number; limit: number } = {
      page: 1,
      limit: APP_LIMITS.articleCommentsPageSize,
    },
  ) {
    const article = await this.articleModel
      .findOne({
        ...(Types.ObjectId.isValid(identifier) && identifier.length === 24
          ? { _id: new Types.ObjectId(identifier) }
          : { slug: identifier }),
        isDeleted: false,
      })
      .select('_id')
      .lean()
      .exec();

    if (!article) {
      throw new NotFoundException('Article topilmadi');
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [comments, total] = await Promise.all([
      this.articleCommentModel
        .find({
          articleId: article._id,
          parentCommentId: null,
          isDeleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.articleCommentModel.countDocuments({
        articleId: article._id,
        parentCommentId: null,
        isDeleted: false,
      }),
    ]);

    const replies = await this.articleCommentModel
      .find({
        articleId: article._id,
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

  async deleteArticle(identifier: string, userId: string) {
    const article = await this.resolveArticle(identifier);

    if (article.author._id.toString() !== userId.toString()) {
      throw new ForbiddenException("Faqat muallif o'chirishi mumkin");
    }

    let markdownContent = '';
    try {
      markdownContent = await this.r2Service.getFileText(article.markdownUrl);
    } catch (error) {
      console.error('Failed to read article markdown before deletion:', error);
    }

    article.isDeleted = true;
    article.likesCount = 0;
    article.viewsCount = 0;
    article.commentsCount = 0;
    await article.save();

    await Promise.all([
      this.articleCommentModel.deleteMany({ articleId: article._id }).exec(),
      this.articleEngagementModel.deleteMany({ articleId: article._id }).exec(),
    ]);

    const assetUrls = this.collectManagedAssetUrls(
      markdownContent,
      article.coverImage,
      article.markdownUrl,
    );

    await Promise.allSettled(
      assetUrls.map((assetUrl) => this.r2Service.deleteFile(assetUrl)),
    );

    return { deleted: true };
  }
}
