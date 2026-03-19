import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, type ChatDocument } from '../chats/schemas/chat.schema';
import { Course, type CourseDocument } from '../courses/schemas/course.schema';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Meet, type MeetDocument } from '../meets/schemas/meet.schema';
import { Test, type TestDocument } from '../arena/schemas/test.schema';
import {
  FlashcardDeck,
  type FlashcardDeckDocument,
} from '../arena/schemas/flashcard.schema';
import {
  FlashcardFolder,
  type FlashcardFolderDocument,
} from '../arena/schemas/flashcard-folder.schema';
import {
  SentenceBuilderDeck,
  type SentenceBuilderDeckDocument,
} from '../arena/schemas/sentence-builder.schema';
import {
  TestShareLink,
  type TestShareLinkDocument,
} from '../arena/schemas/test-share-link.schema';
import {
  SentenceBuilderShareLink,
  type SentenceBuilderShareLinkDocument,
} from '../arena/schemas/sentence-builder-share-link.schema';
import {
  BattleHistory,
  type BattleHistoryDocument,
} from '../arena/schemas/battle-history.schema';

type PreviewMetadata = {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: 'website' | 'article';
};

@Injectable()
export class LinkPreviewService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Meet.name) private readonly meetModel: Model<MeetDocument>,
    @InjectModel(Test.name) private readonly testModel: Model<TestDocument>,
    @InjectModel(FlashcardDeck.name)
    private readonly flashcardDeckModel: Model<FlashcardDeckDocument>,
    @InjectModel(FlashcardFolder.name)
    private readonly flashcardFolderModel: Model<FlashcardFolderDocument>,
    @InjectModel(SentenceBuilderDeck.name)
    private readonly sentenceBuilderDeckModel: Model<SentenceBuilderDeckDocument>,
    @InjectModel(TestShareLink.name)
    private readonly testShareLinkModel: Model<TestShareLinkDocument>,
    @InjectModel(SentenceBuilderShareLink.name)
    private readonly sentenceBuilderShareLinkModel: Model<SentenceBuilderShareLinkDocument>,
    @InjectModel(BattleHistory.name)
    private readonly battleHistoryModel: Model<BattleHistoryDocument>,
  ) {}

  private get frontendBaseUrl() {
    const configured =
      this.configService.get<string>('FRONTEND_APP_URL') ||
      this.configService.get<string>('APP_URL') ||
      'https://jamm.uz';

    return String(configured || 'https://jamm.uz').replace(/\/+$/, '');
  }

  private get fallbackImage() {
    return `${this.frontendBaseUrl}/fav.png`;
  }

  private toAbsoluteUrl(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) {
      return this.fallbackImage;
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    try {
      return new URL(raw.startsWith('/') ? raw : `/${raw}`, this.frontendBaseUrl).toString();
    } catch {
      return this.fallbackImage;
    }
  }

  private truncate(value: string, max = 180) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) {
      return clean;
    }

    return `${clean.slice(0, max - 1).trimEnd()}…`;
  }

  private escapeHtml(value?: string | null) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private renderHtml(meta: PreviewMetadata) {
    const title = this.escapeHtml(meta.title);
    const description = this.escapeHtml(meta.description);
    const image = this.escapeHtml(this.toAbsoluteUrl(meta.image));
    const url = this.escapeHtml(meta.url);
    const type = this.escapeHtml(meta.type || 'website');

    return `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="Jamm" />
    <meta property="og:locale" content="uz_UZ" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
        display: grid;
        min-height: 100vh;
        place-items: center;
      }
      .card {
        width: min(92vw, 520px);
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      .eyebrow { color: #94a3b8; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
      .title { font-size: 26px; line-height: 1.15; margin: 10px 0 12px; font-weight: 800; }
      .description { color: #cbd5e1; font-size: 15px; line-height: 1.55; }
      .link { margin-top: 16px; color: #93c5fd; word-break: break-all; font-size: 13px; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">Jamm Preview</div>
      <h1 class="title">${title}</h1>
      <p class="description">${description}</p>
      <div class="link">${url}</div>
    </main>
  </body>
</html>`;
  }

  private withAbsoluteUrl(path: string) {
    return `${this.frontendBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private formatCountLabel(count: number, singular: string, plural = singular) {
    return `${count} ta ${count === 1 ? singular : plural}`;
  }

  private async resolveCreatorMeta(createdBy: unknown) {
    if (!createdBy) {
      return { image: this.fallbackImage, name: 'Jamm' };
    }

    if (typeof createdBy === 'object' && createdBy !== null) {
      const candidate = createdBy as Record<string, any>;
      return {
        image: this.toAbsoluteUrl(candidate.avatar),
        name: String(candidate.nickname || candidate.username || 'Jamm').trim(),
      };
    }

    if (typeof createdBy === 'string' && Types.ObjectId.isValid(createdBy)) {
      const user = await this.userModel
        .findById(createdBy)
        .select('avatar nickname username')
        .lean()
        .exec();

      return {
        image: this.toAbsoluteUrl(user?.avatar),
        name: String(user?.nickname || user?.username || 'Jamm').trim(),
      };
    }

    return { image: this.fallbackImage, name: 'Jamm' };
  }

  async renderGroupPreview(identifier: string, requestPath?: string) {
    const trimmed = String(identifier || '').trim();
    const isJammId = /^\d{5,7}$/.test(trimmed);
    const filter =
      Types.ObjectId.isValid(trimmed) && trimmed.length === 24
        ? { _id: new Types.ObjectId(trimmed), isGroup: true }
        : isJammId
          ? { $or: [{ privateurl: trimmed }, { jammId: Number(trimmed) }], isGroup: true }
          : { privateurl: trimmed, isGroup: true };

    const group = await this.chatModel.findOne(filter).lean().exec();
    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    const title = `${group.name || 'Jamm Guruh'} | Jamm`;
    const description = this.truncate(
      group.description ||
        `${group.name || 'Bu guruh'} guruhiga qo'shiling. ${
          Array.isArray(group.members) ? group.members.length : 0
        } ta a'zo bor.`,
    );

    return this.renderHtml({
      title,
      description,
      image: this.toAbsoluteUrl(group.avatar),
      url: this.withAbsoluteUrl(requestPath || `/groups/${group.privateurl || group.jammId || group._id}`),
    });
  }

  async renderUserPreview(identifier: string, requestPath?: string) {
    const trimmed = String(identifier || '').trim().toLowerCase();
    const isJammId = /^\d{5,7}$/.test(trimmed);
    const filter =
      Types.ObjectId.isValid(trimmed) && trimmed.length === 24
        ? { _id: new Types.ObjectId(trimmed) }
        : isJammId
          ? { jammId: Number(trimmed) }
          : { username: trimmed };

    const user = await this.userModel
      .findOne(filter)
      .select('jammId username nickname avatar bio')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const displayName = String(user.nickname || user.username || 'Jamm User').trim();
    const title = `${displayName} | Jamm`;
    const description = this.truncate(
      user.bio || `@${user.username || user.jammId || 'user'} profili Jamm platformasida.`,
    );

    return this.renderHtml({
      title,
      description,
      image: this.toAbsoluteUrl(user.avatar),
      url: this.withAbsoluteUrl(requestPath || `/users/${user.jammId || user.username || user._id}`),
    });
  }

  async renderArticlePreview(identifier: string, requestPath?: string) {
    const trimmed = String(identifier || '').trim();
    const filter =
      Types.ObjectId.isValid(trimmed) && trimmed.length === 24
        ? { _id: new Types.ObjectId(trimmed), isDeleted: false }
        : { slug: trimmed, isDeleted: false };

    const article = await this.articleModel
      .findOne(filter)
      .populate('author', 'nickname username')
      .lean()
      .exec();

    if (!article) {
      throw new NotFoundException('Maqola topilmadi');
    }

    const author =
      article.author && typeof article.author === 'object'
        ? String((article.author as any).nickname || (article.author as any).username || '').trim()
        : '';

    const title = `${article.title || 'Maqola'} | Jamm`;
    const description = this.truncate(
      article.excerpt || (author ? `${author} yozgan maqola.` : 'Jamm maqolasi.'),
    );

    return this.renderHtml({
      title,
      description,
      image: this.toAbsoluteUrl(article.coverImage),
      url: this.withAbsoluteUrl(requestPath || `/articles/${article.slug || article._id}`),
      type: 'article',
    });
  }

  async renderCoursePreview(courseId: string, lessonId?: string, requestPath?: string) {
    const trimmedCourseId = String(courseId || '').trim();
    const filter =
      Types.ObjectId.isValid(trimmedCourseId) && trimmedCourseId.length === 24
        ? { $or: [{ _id: new Types.ObjectId(trimmedCourseId) }, { urlSlug: trimmedCourseId }] }
        : { urlSlug: trimmedCourseId };

    const course = await this.courseModel.findOne(filter).lean().exec();
    if (!course) {
      throw new NotFoundException('Kurs topilmadi');
    }

    const normalizedLessonId = String(lessonId || '').trim();
    const lesson = normalizedLessonId
      ? (course.lessons || []).find((item: any) => {
          const lessonMongoId = item?._id?.toString?.() || '';
          return lessonMongoId === normalizedLessonId || item?.urlSlug === normalizedLessonId;
        })
      : null;

    const lessonTitle = lesson?.title ? `${lesson.title} | ${course.name}` : '';
    const title = `${lessonTitle || course.name || 'Kurs'} | Jamm`;
    const description = this.truncate(
      lesson?.description || course.description || `${course.name || 'Kurs'} kursini Jamm'da oching.`,
    );

    return this.renderHtml({
      title,
      description,
      image: this.toAbsoluteUrl(course.image),
      url: this.withAbsoluteUrl(
        requestPath ||
          (lesson
            ? `/courses/${course.urlSlug || course._id}/${lesson.urlSlug || lesson._id}`
            : `/courses/${course.urlSlug || course._id}`),
      ),
    });
  }

  async renderMeetPreview(roomId: string, requestPath?: string) {
    const normalizedRoomId = String(roomId || '').trim();
    const meet = await this.meetModel.findOne({ roomId: normalizedRoomId }).lean().exec();
    const title = `${meet?.title || 'Jamm Meet'} | Jamm`;
    const description = this.truncate(
      meet?.isPrivate
        ? 'Shaxsiy video uchrashuv havolasi.'
        : 'Jamm video uchrashuviga shu havola orqali qo‘shiling.',
    );

    return this.renderHtml({
      title,
      description,
      image: this.fallbackImage,
      url: this.withAbsoluteUrl(requestPath || `/join/${normalizedRoomId}`),
    });
  }

  async renderArenaQuizPreview(
    resourceId: string,
    requestPath?: string,
    lessonId?: string,
  ) {
    const normalized = String(resourceId || '').trim();
    const isObjectId = Types.ObjectId.isValid(normalized) && normalized.length === 24;

    let resolvedGroupName = '';
    let test: any = null;

    if (isObjectId) {
      test = await this.testModel
        .findById(normalized)
        .populate('createdBy', 'nickname username avatar')
        .lean()
        .exec();
    } else {
      const shareLink = await this.testShareLinkModel
        .findOne({ shortCode: normalized.toLowerCase() })
        .lean()
        .exec();

      if (!shareLink) {
        throw new NotFoundException('Arena test topilmadi');
      }

      resolvedGroupName = String(shareLink.groupName || '').trim();
      test = await this.testModel
        .findById(shareLink.testId)
        .populate('createdBy', 'nickname username avatar')
        .lean()
        .exec();
    }

    if (!test) {
      throw new NotFoundException('Arena test topilmadi');
    }

    const creator = await this.resolveCreatorMeta(test.createdBy);
    const questionCount = Array.isArray(test.questions) ? test.questions.length : 0;
    const groupSegment = resolvedGroupName ? ` ${resolvedGroupName} guruhi uchun` : '';
    const title = `${test.title || 'Arena Test'} | Jamm`;
    const description = this.truncate(
      test.description ||
        `${creator.name} yaratgan${groupSegment} arena testi. ${this.formatCountLabel(
          questionCount,
          'savol',
        )} bilan mashqni boshlang.`,
    );

    const targetPath =
      requestPath ||
      (lessonId
        ? `/arena/quiz/${normalized}/${lessonId}`
        : isObjectId
          ? `/arena/quiz/${normalized}`
          : `/arena/quiz-link/${normalized}`);

    return this.renderHtml({
      title,
      description,
      image: creator.image,
      url: this.withAbsoluteUrl(targetPath),
    });
  }

  async renderArenaFlashcardPreview(resourceId: string, requestPath?: string) {
    const normalized = String(resourceId || '').trim();
    const filter =
      Types.ObjectId.isValid(normalized) && normalized.length === 24
        ? { $or: [{ _id: new Types.ObjectId(normalized) }, { urlSlug: normalized }] }
        : { urlSlug: normalized };

    const deck = await this.flashcardDeckModel
      .findOne(filter)
      .populate('createdBy', 'nickname username avatar')
      .lean()
      .exec();

    if (!deck) {
      throw new NotFoundException('Flashcard to‘plami topilmadi');
    }

    const creator = await this.resolveCreatorMeta(deck.createdBy);
    const cardCount = Array.isArray(deck.cards) ? deck.cards.length : 0;
    const memberCount = Array.isArray(deck.members) ? deck.members.length : 0;
    const title = `${deck.title || 'Flashcards'} | Jamm`;
    const description = this.truncate(
      `${creator.name} yaratgan flashcard to‘plami. ${this.formatCountLabel(
        cardCount,
        'karta',
      )}, ${this.formatCountLabel(memberCount, `a'zo`)}.`,
    );

    return this.renderHtml({
      title,
      description,
      image: creator.image,
      url: this.withAbsoluteUrl(requestPath || `/arena/flashcards/${deck.urlSlug || deck._id}`),
    });
  }

  async renderArenaFlashcardFolderPreview(resourceId: string, requestPath?: string) {
    const normalized = String(resourceId || '').trim();
    const filter =
      Types.ObjectId.isValid(normalized) && normalized.length === 24
        ? { $or: [{ _id: new Types.ObjectId(normalized) }, { urlSlug: normalized }] }
        : { urlSlug: normalized };

    const folder = await this.flashcardFolderModel
      .findOne(filter)
      .populate('createdBy', 'nickname username avatar')
      .lean()
      .exec();

    if (!folder) {
      throw new NotFoundException('Flashcard papka topilmadi');
    }

    const deckCount = await this.flashcardDeckModel.countDocuments({ folderId: folder._id }).exec();
    const creator = await this.resolveCreatorMeta(folder.createdBy);
    const memberCount = Array.isArray(folder.members) ? folder.members.length : 0;
    const title = `${folder.title || 'Flashcard papka'} | Jamm`;
    const description = this.truncate(
      `${creator.name} yaratgan flashcard papka. ${this.formatCountLabel(
        deckCount,
        'to‘plam',
      )}, ${this.formatCountLabel(memberCount, `a'zo`)}.`,
    );

    return this.renderHtml({
      title,
      description,
      image: creator.image,
      url: this.withAbsoluteUrl(
        requestPath || `/arena/flashcard-folders/${folder.urlSlug || folder._id}`,
      ),
    });
  }

  async renderArenaSentenceBuilderPreview(resourceId: string, requestPath?: string) {
    const normalized = String(resourceId || '').trim();
    const isObjectId = Types.ObjectId.isValid(normalized) && normalized.length === 24;

    let resolvedGroupName = '';
    let deck: any = null;

    if (isObjectId) {
      deck = await this.sentenceBuilderDeckModel
        .findById(normalized)
        .populate('createdBy', 'nickname username avatar')
        .lean()
        .exec();
    } else {
      const shareLink = await this.sentenceBuilderShareLinkModel
        .findOne({ shortCode: normalized.toLowerCase() })
        .lean()
        .exec();

      if (!shareLink) {
        throw new NotFoundException('Sentence builder topilmadi');
      }

      resolvedGroupName = String(shareLink.groupName || '').trim();
      deck = await this.sentenceBuilderDeckModel
        .findById(shareLink.deckId)
        .populate('createdBy', 'nickname username avatar')
        .lean()
        .exec();
    }

    if (!deck) {
      throw new NotFoundException('Sentence builder topilmadi');
    }

    const creator = await this.resolveCreatorMeta(deck.createdBy);
    const questionCount = Array.isArray(deck.items) ? deck.items.length : 0;
    const groupSegment = resolvedGroupName ? ` ${resolvedGroupName} guruhi uchun` : '';
    const title = `${deck.title || 'Sentence Builder'} | Jamm`;
    const description = this.truncate(
      deck.description ||
        `${creator.name} yaratgan${groupSegment} sentence builder mashqi. ${this.formatCountLabel(
          questionCount,
          'gap',
        )} bilan mashq qiling.`,
    );

    return this.renderHtml({
      title,
      description,
      image: creator.image,
      url: this.withAbsoluteUrl(
        requestPath ||
          (isObjectId
            ? `/arena/sentence-builder/${deck._id}`
            : `/arena/sentence-builder/${normalized}`),
      ),
    });
  }

  async renderArenaBattlePreview(roomId: string, requestPath?: string) {
    const normalized = String(roomId || '').trim();
    const battle = await this.battleHistoryModel
      .findOne({ roomId: normalized })
      .populate('testId', 'title description')
      .lean()
      .exec();

    const battleTest = battle?.testId && typeof battle.testId === 'object' ? (battle.testId as any) : null;
    const title = battleTest?.title
      ? `${battleTest.title} Battle | Jamm`
      : 'Arena Battle | Jamm';
    const participantCount = Array.isArray(battle?.participants) ? battle!.participants.length : 0;
    const description = this.truncate(
      battleTest?.description ||
        (participantCount > 0
          ? `Arena battle xonasi. ${this.formatCountLabel(participantCount, 'ishtirokchi')} tayyor.`
          : 'Arena battle xonasiga qo‘shilib jonli bellashuvni boshlang.'),
    );

    return this.renderHtml({
      title,
      description,
      image: this.fallbackImage,
      url: this.withAbsoluteUrl(requestPath || `/arena/battle/${normalized}`),
    });
  }

  async renderDirectSlugPreview(slug: string, requestPath?: string) {
    const normalized = String(slug || '').trim();
    if (!normalized) {
      throw new NotFoundException('Preview topilmadi');
    }

    if (normalized.startsWith('-')) {
      return this.renderGroupPreview(normalized, requestPath);
    }

    if (normalized.startsWith(':')) {
      return this.renderArticlePreview(normalized, requestPath);
    }

    if (normalized.startsWith('+')) {
      return this.renderCoursePreview(normalized, undefined, requestPath);
    }

    return this.renderUserPreview(normalized, requestPath);
  }
}
