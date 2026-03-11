import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Test, TestDocument } from './schemas/test.schema';
import {
  FlashcardDeck,
  FlashcardDeckDocument,
} from './schemas/flashcard.schema';
import {
  BattleHistory,
  BattleHistoryDocument,
} from './schemas/battle-history.schema';
import {
  FlashcardProgress,
  FlashcardProgressDocument,
} from './schemas/flashcard-progress.schema';
import {
  SentenceBuilderDeck,
  SentenceBuilderDeckDocument,
} from './schemas/sentence-builder.schema';
import {
  TestShareLink,
  TestShareLinkDocument,
} from './schemas/test-share-link.schema';
import {
  SentenceBuilderShareLink,
  SentenceBuilderShareLinkDocument,
} from './schemas/sentence-builder-share-link.schema';
import {
  SentenceBuilderAttempt,
  SentenceBuilderAttemptDocument,
} from './schemas/sentence-builder-attempt.schema';
import {
  MnemonicResult,
  MnemonicResultDocument,
} from './schemas/mnemonic-result.schema';
import { UsersService } from '../users/users.service';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  assertMaxChars,
  getTierLimit,
} from '../common/limits/app-limits';
import { generateShortSlug } from '../common/utils/generate-short-slug';

export interface BattleRoom {
  roomId: string;
  testId: string;
  hostId: string;
  roomName: string;
  mode: 'solo' | 'team';
  status: 'waiting' | 'playing' | 'finished';
  visibility: 'public' | 'unlisted';
  currentQuestionIndex: number;
  participants: {
    socketId: string;
    userId: string;
    nickname: string;
    score: number;
    team?: string;
    hasAnsweredCurrent: boolean;
  }[];
}

@Injectable()
export class ArenaService {
  constructor(
    @InjectModel(Test.name) private testModel: Model<TestDocument>,
    @InjectModel(FlashcardDeck.name)
    private flashcardModel: Model<FlashcardDeckDocument>,
    @InjectModel(SentenceBuilderDeck.name)
    private sentenceBuilderModel: Model<SentenceBuilderDeckDocument>,
    @InjectModel(BattleHistory.name)
    private battleHistoryModel: Model<BattleHistoryDocument>,
    @InjectModel(FlashcardProgress.name)
    private progressModel: Model<FlashcardProgressDocument>,
    @InjectModel(TestShareLink.name)
    private testShareLinkModel: Model<TestShareLinkDocument>,
    @InjectModel(SentenceBuilderShareLink.name)
    private sentenceBuilderShareLinkModel: Model<SentenceBuilderShareLinkDocument>,
    @InjectModel(SentenceBuilderAttempt.name)
    private sentenceBuilderAttemptModel: Model<SentenceBuilderAttemptDocument>,
    @InjectModel(MnemonicResult.name)
    private mnemonicResultModel: Model<MnemonicResultDocument>,
    private usersService: UsersService,
  ) {}

  private normalizeMnemonicMode(mode: string): 'digits' | 'words' {
    return mode === 'words' ? 'words' : 'digits';
  }

  private activeBattles: Map<string, BattleRoom> = new Map();

  private tokenizeSentence(value: string): string[] {
    return String(value || '')
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private normalizeSentenceBuilderItems(items: any[] = []) {
    return items
      .map((item) => {
        const prompt = String(item?.prompt || '').trim();
        const answer = String(item?.answer || '').trim();
        const answerTokens = this.tokenizeSentence(answer);
        const extraTokens = Array.isArray(item?.extraTokens)
          ? item.extraTokens
          : String(item?.extraTokens || '')
              .split(',')
              .map((token) => token.trim());

        return {
          prompt,
          answer,
          answerTokens,
          extraTokens: extraTokens.filter(Boolean),
        };
      })
      .filter((item) => item.prompt && item.answer && item.answerTokens.length);
  }

  private parseSentenceBuilderPattern(pattern: string) {
    const blocks = String(pattern || '')
      .split(/\n\s*\n+/)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks
      .map((block) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const promptLine = lines.find((line) => line.startsWith('$'));
        const answerLine = lines.find(
          (line) =>
            (line.startsWith('"') && line.endsWith('"')) ||
            (line.startsWith("'") && line.endsWith("'")),
        );
        const extraLine = lines.find(
          (line) =>
            (line.startsWith('+') && line.endsWith('+')) ||
            (line.startsWith('`') && line.endsWith('`')),
        );

        const prompt = promptLine ? promptLine.replace(/^\$\s*/, '').trim() : '';
        const answer = answerLine ? answerLine.slice(1, -1).trim() : '';
        const answerTokens = this.tokenizeSentence(answer);
        const extraTokens = extraLine
          ? extraLine
              .slice(1, -1)
              .split(',')
              .map((token) => token.trim())
              .filter(Boolean)
          : [];

        return {
          prompt,
          answer,
          answerTokens,
          extraTokens,
        };
      })
      .filter((item) => item.prompt && item.answer && item.answerTokens.length);
  }

  private shuffleTokens(tokens: string[]) {
    const copy = [...tokens];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private normalizeShareGroupName(value?: string) {
    return String(value || '')
      .replace(/[()]/g, '')
      .trim()
      .slice(0, APP_TEXT_LIMITS.shareGroupNameChars);
  }

  private validateTestPayload(data: any) {
    const title = String(data?.title || '').trim();
    const description = String(data?.description || '').trim();
    assertMaxChars('Test nomi', title, APP_TEXT_LIMITS.testTitleChars);
    assertMaxChars(
      'Test tavsifi',
      description,
      APP_TEXT_LIMITS.testDescriptionChars,
    );

    const questions = Array.isArray(data?.questions)
      ? data.questions
          .map((question: any) => ({
            questionText: String(question?.questionText || '').trim(),
            options: Array.isArray(question?.options)
              ? question.options
                  .map((option: any) => String(option || '').trim())
                  .filter(Boolean)
              : [],
            correctOptionIndex: Number(question?.correctOptionIndex),
          }))
          .filter((question) => question.questionText && question.options.length >= 2)
      : [];

    questions.forEach((question) => {
      assertMaxChars(
        'Test savoli',
        question.questionText,
        APP_TEXT_LIMITS.testQuestionChars,
      );
      question.options.forEach((option) =>
        assertMaxChars(
          'Test varianti',
          option,
          APP_TEXT_LIMITS.testOptionChars,
        ),
      );
    });

    return { title, description, questions };
  }

  private validateFlashcardPayload(data: any) {
    const title = String(data?.title || '').trim();
    assertMaxChars('Lug‘at nomi', title, APP_TEXT_LIMITS.flashcardTitleChars);

    const cards = Array.isArray(data?.cards)
      ? data.cards
          .map((card: any) => ({
            front: String(card?.front || '').trim(),
            back: String(card?.back || '').trim(),
            frontImage: String(card?.frontImage || '').trim(),
            backImage: String(card?.backImage || '').trim(),
          }))
          .filter((card) => card.front && card.back)
      : [];

    cards.forEach((card) => {
      assertMaxChars(
        'Flashcard old tomoni',
        card.front,
        APP_TEXT_LIMITS.flashcardSideChars,
      );
      assertMaxChars(
        'Flashcard orqa tomoni',
        card.back,
        APP_TEXT_LIMITS.flashcardSideChars,
      );
    });

    return { title, cards };
  }

  private async generateUniqueFlashcardDeckSlug(
    excludeDeckId?: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = generateShortSlug(10);
      const existing = await this.flashcardModel
        .findOne({
          urlSlug: slug,
          ...(excludeDeckId
            ? { _id: { $ne: new Types.ObjectId(excludeDeckId) } }
            : {}),
        })
        .select('_id')
        .lean()
        .exec();

      if (!existing) {
        return slug;
      }
    }

    throw new BadRequestException(
      'Flashcard havolasi yaratilmadi, qayta urinib ko‘ring',
    );
  }

  private buildFlashcardDeckIdentifierQuery(identifier: string) {
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    const isObjectId =
      Types.ObjectId.isValid(normalizedIdentifier) &&
      String(new Types.ObjectId(normalizedIdentifier)) === normalizedIdentifier;

    if (isObjectId) {
      return {
        $or: [
          { _id: new Types.ObjectId(normalizedIdentifier) },
          { urlSlug: normalizedIdentifier },
        ],
      };
    }

    return { urlSlug: normalizedIdentifier };
  }

  private async ensureFlashcardDeckSlug<T extends { _id: Types.ObjectId; urlSlug?: string }>(
    deck: T,
  ): Promise<T> {
    if (deck?.urlSlug) {
      return deck;
    }

    const slug = await this.generateUniqueFlashcardDeckSlug(deck._id.toString());
    await this.flashcardModel
      .updateOne(
        {
          _id: deck._id,
          $or: [
            { urlSlug: { $exists: false } },
            { urlSlug: null },
            { urlSlug: '' },
          ],
        },
        { $set: { urlSlug: slug } },
      )
      .exec();

    deck.urlSlug = slug;
    return deck;
  }

  private async findFlashcardDeckByIdentifier(identifier: string) {
    return this.flashcardModel
      .findOne(this.buildFlashcardDeckIdentifierQuery(identifier))
      .exec();
  }

  private validateSentenceBuilderPayload(data: any, items: any[]) {
    const title = String(data?.title || '').trim();
    const description = String(data?.description || '').trim();
    assertMaxChars(
      "Gap tuzish nomi",
      title,
      APP_TEXT_LIMITS.sentenceBuilderTitleChars,
    );
    assertMaxChars(
      "Gap tuzish tavsifi",
      description,
      APP_TEXT_LIMITS.sentenceBuilderDescriptionChars,
    );

    items.forEach((item: any) => {
      assertMaxChars(
        'Savol',
        item.prompt,
        APP_TEXT_LIMITS.sentenceBuilderPromptChars,
      );
      assertMaxChars(
        'Javob',
        item.answer,
        APP_TEXT_LIMITS.sentenceBuilderAnswerChars,
      );
      (item.answerTokens || []).forEach((token: string) =>
        assertMaxChars(
          'Javob bo‘lagi',
          token,
          APP_TEXT_LIMITS.sentenceBuilderTokenChars,
        ),
      );
      (item.extraTokens || []).forEach((token: string) =>
        assertMaxChars(
          'Chalg‘ituvchi bo‘lak',
          token,
          APP_TEXT_LIMITS.sentenceBuilderTokenChars,
        ),
      );
    });

    return { title, description };
  }

  private async generateUniqueShareCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = Math.random().toString(36).slice(2, 8).toLowerCase();
      const exists = await this.testShareLinkModel.exists({
        shortCode: candidate,
      });
      if (!exists) return candidate;
    }

    return `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 4)}`.toLowerCase();
  }

  private async generateUniqueShareCodeForModel(model: Model<any>) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = Math.random().toString(36).slice(2, 8).toLowerCase();
      const exists = await model.exists({
        shortCode: candidate,
      });
      if (!exists) return candidate;
    }

    return `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 4)}`.toLowerCase();
  }

  private evaluateSentenceBuilderAnswer(
    expectedTokens: string[] = [],
    selectedTokens: string[] = [],
  ) {
    const actual = Array.isArray(selectedTokens)
      ? selectedTokens.map((token) => String(token || '').trim()).filter(Boolean)
      : [];
    const expected = Array.isArray(expectedTokens)
      ? expectedTokens.map((token) => String(token || '').trim()).filter(Boolean)
      : [];
    const maxLength = Math.max(actual.length, expected.length);
    const mistakes: {
      position: number;
      actual: string | null;
      expected: string | null;
    }[] = [];

    for (let index = 0; index < maxLength; index += 1) {
      if (actual[index] !== expected[index]) {
        mistakes.push({
          position: index + 1,
          actual: actual[index] || null,
          expected: expected[index] || null,
        });
      }
    }

    return {
      actual,
      expected,
      mistakes,
      isCorrect: mistakes.length === 0,
    };
  }

  async saveMnemonicBestResult(
    userId: string,
    body: {
      mode?: string;
      score?: number;
      total?: number;
      elapsedMemorizeMs?: number;
    },
  ) {
    const mode = this.normalizeMnemonicMode(String(body?.mode || 'digits'));
    const score = Math.max(0, Number(body?.score) || 0);
    const total = Math.max(1, Number(body?.total) || 1);
    const elapsedMemorizeMs = Math.max(0, Number(body?.elapsedMemorizeMs) || 0);

    if (score > total) {
      throw new BadRequestException('Mnemonic natijasi noto‘g‘ri');
    }

    const accuracy = total ? Math.round((score / total) * 100) : 0;
    const query = {
      userId: new Types.ObjectId(userId),
      mode,
    };
    const existing = await this.mnemonicResultModel.findOne(query).lean().exec();

    const shouldReplace =
      !existing ||
      score > existing.score ||
      (score === existing.score &&
        elapsedMemorizeMs < existing.elapsedMemorizeMs);

    if (!shouldReplace) {
      return {
        saved: false,
        replaced: false,
        best: existing,
      };
    }

    const best = await this.mnemonicResultModel.findOneAndUpdate(
      query,
      {
        $set: {
          score,
          total,
          elapsedMemorizeMs,
          accuracy,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return {
      saved: true,
      replaced: Boolean(existing),
      best,
    };
  }

  async getMnemonicLeaderboard(mode: string, currentUserId?: string) {
    const normalizedMode = this.normalizeMnemonicMode(mode);
    const topResults = await this.mnemonicResultModel
      .find({ mode: normalizedMode })
      .sort({ score: -1, elapsedMemorizeMs: 1, updatedAt: 1 })
      .limit(20)
      .populate(
        'userId',
        '_id username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
      )
      .lean()
      .exec();

    const leaderboard = topResults.map((item: any, index) => ({
      rank: index + 1,
      score: item.score,
      total: item.total,
      accuracy: item.accuracy,
      elapsedMemorizeMs: item.elapsedMemorizeMs,
      updatedAt: item.updatedAt,
      user: item.userId
        ? {
            _id: item.userId._id,
            username: item.userId.username,
            nickname: item.userId.nickname,
            avatar: item.userId.avatar,
            premiumStatus: item.userId.premiumStatus,
            selectedProfileDecorationId:
              item.userId.selectedProfileDecorationId || null,
            customProfileDecorationImage:
              item.userId.customProfileDecorationImage || null,
          }
        : null,
    }));

    let currentUserBest:
      | {
          rank: number;
          score: number;
          total: number;
          accuracy: number;
          elapsedMemorizeMs: number;
          updatedAt: Date | undefined;
          user: {
            _id: Types.ObjectId;
            username: string;
            nickname: string;
            avatar: string;
            premiumStatus: string;
            selectedProfileDecorationId: string | null;
            customProfileDecorationImage: string | null;
          } | null;
        }
      | null = null;

    if (currentUserId) {
      const current = await this.mnemonicResultModel
        .findOne({
          userId: new Types.ObjectId(currentUserId),
          mode: normalizedMode,
        })
        .populate(
          'userId',
          '_id username nickname avatar premiumStatus selectedProfileDecorationId customProfileDecorationImage',
        )
        .lean()
        .exec();

      if (current) {
        const populatedUser = current.userId as any;
        const betterCount = await this.mnemonicResultModel.countDocuments({
          mode: normalizedMode,
          $or: [
            { score: { $gt: current.score } },
            {
              score: current.score,
              elapsedMemorizeMs: { $lt: current.elapsedMemorizeMs },
            },
          ],
        });

        currentUserBest = {
          rank: betterCount + 1,
          score: current.score,
          total: current.total,
          accuracy: current.accuracy,
          elapsedMemorizeMs: current.elapsedMemorizeMs,
          updatedAt: (current as any).updatedAt,
          user: populatedUser
            ? {
                _id: populatedUser._id,
                username: populatedUser.username,
                nickname: populatedUser.nickname,
                avatar: populatedUser.avatar,
                premiumStatus: populatedUser.premiumStatus,
                selectedProfileDecorationId:
                  populatedUser.selectedProfileDecorationId || null,
                customProfileDecorationImage:
                  populatedUser.customProfileDecorationImage || null,
              }
            : null,
        };
      }
    }

    return {
      mode: normalizedMode,
      leaderboard,
      currentUserBest,
    };
  }

  getActiveBattlesList(
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ) {
    const activeRooms = Array.from(this.activeBattles.values())
      .filter((b) => b.status === 'waiting' && b.visibility === 'public')
      .map((b) => ({
        roomId: b.roomId,
        roomName: b.roomName,
        testId: b.testId,
        hostId: b.hostId,
        mode: b.mode,
        status: b.status,
        visibility: b.visibility,
        participantsCount: b.participants.length,
      }));

    const skip = (pagination.page - 1) * pagination.limit;
    const paginated = activeRooms.slice(skip, skip + pagination.limit);

    return {
      data: paginated,
      total: activeRooms.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(activeRooms.length / pagination.limit),
    };
  }

  getActiveBattle(roomId: string): BattleRoom | undefined {
    return this.activeBattles.get(roomId);
  }

  createActiveBattle(room: BattleRoom): void {
    this.activeBattles.set(room.roomId, room);
  }

  removeActiveBattle(roomId: string): void {
    this.activeBattles.delete(roomId);
  }

  getAllActiveBattlesRaw(): Map<string, BattleRoom> {
    return this.activeBattles;
  }

  /* ---- TESTS ---- */

  async createTest(userId: string, data: any): Promise<TestDocument> {
    if (data.questions && data.questions.length > 30) {
      throw new BadRequestException(
        'Testda savollar soni 30 tadan oshmasligi kerak',
      );
    }

    const user = await this.usersService.findById(userId);
    const limit = getTierLimit(APP_LIMITS.testsCreated, user?.premiumStatus);

    const count = await this.testModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta test yarata olasiz. Ko'proq imkoniyat uchun Premium sotib oling.`,
      );
    }

    const { title, description, questions } = this.validateTestPayload(data);
    if (!title) {
      throw new BadRequestException('Test nomi kiritilishi shart');
    }

    if (questions.length === 0) {
      throw new BadRequestException('Kamida bitta savol bo‘lishi kerak');
    }

    if (
      questions.some(
        (question) =>
          question.correctOptionIndex < 0 ||
          question.correctOptionIndex >= question.options.length,
      )
    ) {
      throw new BadRequestException("Har bir savolda to'g'ri javob belgilang");
    }

    const createdTest = new this.testModel({
      title,
      description,
      createdBy: new Types.ObjectId(userId),
      questions,
      isPublic: data?.isPublic !== false,
      displayMode: data?.displayMode === 'list' ? 'list' : 'single',
    });
    return createdTest.save();
  }

  async updateTest(
    testId: string,
    userId: string,
    data: any,
  ): Promise<TestDocument> {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat test yaratuvchisi uni tahrirlay oladi");
    }

    if (data.questions && data.questions.length > 30) {
      throw new BadRequestException(
        'Testda savollar soni 30 tadan oshmasligi kerak',
      );
    }

    const { title, description, questions } = this.validateTestPayload(data);
    if (!title) {
      throw new BadRequestException('Test nomi kiritilishi shart');
    }

    if (questions.length === 0) {
      throw new BadRequestException('Kamida bitta savol bo‘lishi kerak');
    }

    if (
      questions.some(
        (question) =>
          question.correctOptionIndex < 0 ||
          question.correctOptionIndex >= question.options.length,
      )
    ) {
      throw new BadRequestException("Har bir savolda to'g'ri javob belgilang");
    }

    test.title = title;
    test.description = description;
    test.questions = questions as any;
    test.isPublic = data?.isPublic !== false;
    test.displayMode = data?.displayMode === 'list' ? 'list' : 'single';

    return test.save();
  }

  async getAllTests(): Promise<any[]> {
    const tests = await this.testModel
      .find({ isPublic: true })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username nickname avatar')
      .lean()
      .exec();

    // Strip correctOptionIndex — never expose answers to the client
    return tests.map((test) => ({
      ...test,
      questions: test.questions.map((q: any) => {
        const { correctOptionIndex, ...safeQuestion } = q;
        return safeQuestion;
      }),
    }));
  }

  async getUserTests(
    userId: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 20 },
  ): Promise<any> {
    const skip = (pagination.page - 1) * pagination.limit;

    const [tests, total] = await Promise.all([
      this.testModel
        .find({ createdBy: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'username nickname avatar')
        .skip(skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.testModel.countDocuments({ createdBy: new Types.ObjectId(userId) }),
    ]);

    // Strip correctOptionIndex — never expose answers to the client
    const data = tests.map((test) => {
      const { __v, ...safeTest } = test as any;
      return {
        ...safeTest,
        questions: test.questions.map((q: any) => {
          const { correctOptionIndex, ...safeQuestion } = q;
          return safeQuestion;
        }),
      };
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  // Internal use only — includes correctOptionIndex for server-side validation
  async getTestByIdInternal(id: string): Promise<TestDocument> {
    const test = await this.testModel.findById(id).exec();
    if (!test) throw new NotFoundException('Test topilmadi');
    return test;
  }

  async getTestById(id: string, requestUserId?: string): Promise<any> {
    const isObjectId =
      Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
    if (!isObjectId) throw new NotFoundException('Natogri ID');

    const test = await this.testModel
      .findById(id)
      .populate('createdBy', 'username nickname avatar')
      .lean()
      .exec();

    if (!test) throw new NotFoundException('Test topilmadi');

    // Only the creator can see correctOptionIndex
    const isCreator =
      requestUserId && test.createdBy?._id?.toString() === requestUserId;
    if (isCreator) return test;

    return {
      ...test,
      questions: test.questions.map((q: any) => {
        const { correctOptionIndex, ...safeQuestion } = q;
        return safeQuestion;
      }),
    };
  }

  async submitAnswers(
    testId: string,
    userId: string,
    answers: number[],
    shareShortCode?: string,
    options?: { includeHiddenResults?: boolean },
  ): Promise<{
    score: number;
    total: number;
    showResults: boolean;
    results: {
      questionIndex: number;
      correct: boolean;
      correctOptionIndex: number;
    }[];
  }> {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    const shareConfig = await this.resolveShareLinkByShortCode(
      String(shareShortCode || '').trim() || undefined,
    );

    const results = test.questions.map((q, i) => ({
      questionIndex: i,
      correct: q.correctOptionIndex === answers[i],
      correctOptionIndex: q.correctOptionIndex,
    }));

    const score = results.filter((r) => r.correct).length;
    const includeHiddenResults = options?.includeHiddenResults === true;

    return {
      score,
      total: test.questions.length,
      showResults: shareConfig.showResults,
      results:
        shareConfig.showResults || includeHiddenResults ? results : [],
    };
  }

  async saveBattleHistory(battleData: any): Promise<BattleHistoryDocument> {
    try {
      // IDEMPOTENCY CHECK: Don't save if roomId already exists
      const existing = await this.battleHistoryModel.findOne({
        roomId: battleData.roomId,
      });
      if (existing) return existing;

      const history = new this.battleHistoryModel({
        roomId: battleData.roomId,
        testId: new Types.ObjectId(battleData.testId),
        hostId: Types.ObjectId.isValid(battleData.hostId)
          ? new Types.ObjectId(battleData.hostId)
          : battleData.hostId,
        mode: battleData.mode,
        participants: battleData.participants.map((p: any) => ({
          userId: Types.ObjectId.isValid(p.userId)
            ? new Types.ObjectId(p.userId)
            : p.userId,
          nickname: p.nickname,
          score: p.score,
          total: Number.isFinite(p.total) ? p.total : undefined,
          answers: Array.isArray(p.answers)
            ? p.answers.map((value: any) => Number(value))
            : undefined,
          results: Array.isArray(p.results)
            ? p.results.map((item: any) => ({
                questionIndex: Number(item.questionIndex),
                correct: Boolean(item.correct),
                correctOptionIndex: Number(item.correctOptionIndex),
              }))
            : undefined,
        })),
      });

      return await history.save();
    } catch (err) {
      console.error('[ArenaService] Error in saveBattleHistory:', err);
      throw err;
    }
  }

  async getUserBattleHistory(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<any> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { 'participants.userId': userId },
        {
          hostId: Types.ObjectId.isValid(userId)
            ? new Types.ObjectId(userId)
            : userId,
          'participants.1': { $exists: true }, // At least 2 participants
        },
      ],
    };

    const [data, total] = await Promise.all([
      this.battleHistoryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('testId', 'title')
        .exec(),
      this.battleHistoryModel.countDocuments(query),
    ]);

    return {
      data: data.map((d: any) => {
        const { __v, ...safeData } = d.toObject ? d.toObject() : d;
        return safeData;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getResultsForTest(
    testId: string,
    userId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<any> {
    const test = await this.testModel.findById(testId);
    if (!test) throw new NotFoundException('Test topilmadi');

    // Only creator can see all results
    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException('Faqat yaratuvchi natijalarni kora oladi');
    }

    const { page, limit, search } = pagination;
    const skip = (page - 1) * limit;

    const query: any = { testId: new Types.ObjectId(testId) };
    if (search) {
      query['participants.nickname'] = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.battleHistoryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.battleHistoryModel.countDocuments(query),
    ]);

    return {
      data: data.map((d: any) => {
        const { __v, ...safeData } = d.toObject ? d.toObject() : d;
        return safeData;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listTestShareLinks(testId: string, userId: string) {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat test yaratuvchisi linklarni ko'ra oladi",
      );
    }

    const links = await this.testShareLinkModel
      .find({
        testId: new Types.ObjectId(testId),
        createdBy: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return links.map((link) => ({
      _id: link._id,
      shortCode: link.shortCode,
      groupName: link.groupName,
      persistResults: link.persistResults !== false,
      showResults: link.showResults !== false,
      timeLimit: Math.max(0, Number(link.timeLimit) || 0),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));
  }

  async createTestShareLink(
    testId: string,
    userId: string,
    options: {
      persistResults?: boolean;
      groupName?: string;
      showResults?: boolean;
      timeLimit?: number;
    },
  ) {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat test yaratuvchisi xavfsiz havola yarata oladi",
      );
    }

    const user = await this.usersService.findById(userId);
    const shareLimit = getTierLimit(
      APP_LIMITS.testShareLinksPerTest,
      user?.premiumStatus,
    );
    const currentCount = await this.testShareLinkModel.countDocuments({
      testId: new Types.ObjectId(testId),
      createdBy: new Types.ObjectId(userId),
    });

    if (currentCount >= shareLimit) {
      throw new ForbiddenException(
        `Maksimal ${shareLimit} ta test havolasi yaratishingiz mumkin`,
      );
    }

    const persistResults = options?.persistResults !== false;
    const groupName = persistResults
      ? this.normalizeShareGroupName(options?.groupName)
      : '';
    const showResults = options?.showResults !== false;
    const timeLimit = Math.max(0, Number(options?.timeLimit) || 0);

    if (persistResults && !groupName) {
      throw new BadRequestException('Guruh nomini kiriting');
    }

    const link = await this.testShareLinkModel.create({
      testId: new Types.ObjectId(testId),
      createdBy: new Types.ObjectId(userId),
      shortCode: await this.generateUniqueShareCode(),
      groupName,
      persistResults,
      showResults,
      timeLimit,
    });

    return {
      _id: link._id,
      shortCode: link.shortCode,
      persistResults: link.persistResults !== false,
      showResults: link.showResults !== false,
      timeLimit: Math.max(0, Number(link.timeLimit) || 0),
      groupName: link.groupName,
      createdAt: link.createdAt,
    };
  }

  async deleteTestShareLink(testId: string, shareLinkId: string, userId: string) {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat test yaratuvchisi havolani o'chira oladi",
      );
    }

    const deleted = await this.testShareLinkModel.findOneAndDelete({
      _id: new Types.ObjectId(shareLinkId),
      testId: new Types.ObjectId(testId),
      createdBy: new Types.ObjectId(userId),
    });

    if (!deleted) {
      throw new NotFoundException('Havola topilmadi');
    }

    return { deleted: true, deletedShareLinkId: shareLinkId };
  }

  async getSharedTestByShortCode(shortCode: string, requestUserId?: string) {
    const shareLink = await this.testShareLinkModel
      .findOne({ shortCode: String(shortCode || '').trim().toLowerCase() })
      .lean()
      .exec();

    if (!shareLink) {
      throw new NotFoundException('Test havolasi topilmadi');
    }

    const test = await this.getTestById(shareLink.testId.toString(), requestUserId);

    return {
      test: {
        ...test,
        showResults: shareLink.showResults !== false,
        timeLimit: Math.max(0, Number(shareLink.timeLimit) || 0),
      },
      shareLink: {
        shortCode: shareLink.shortCode,
        persistResults: shareLink.persistResults !== false,
        groupName: shareLink.groupName,
        showResults: shareLink.showResults !== false,
        timeLimit: Math.max(0, Number(shareLink.timeLimit) || 0),
      },
    };
  }

  async resolveShareLinkByShortCode(
    shortCode?: string,
  ): Promise<{
    persistResults: boolean;
    groupName: string;
    showResults: boolean;
    timeLimit: number;
  }> {
    if (!shortCode) {
      return {
        persistResults: true,
        groupName: '',
        showResults: true,
        timeLimit: 0,
      };
    }

    const shareLink = await this.testShareLinkModel
      .findOne({ shortCode: String(shortCode || '').trim().toLowerCase() })
      .lean()
      .exec();

    if (!shareLink) {
      throw new BadRequestException('Test havolasi yaroqsiz');
    }

    return {
      persistResults: shareLink.persistResults !== false,
      groupName:
        shareLink.persistResults !== false
          ? this.normalizeShareGroupName(shareLink.groupName)
          : '',
      showResults: shareLink.showResults !== false,
      timeLimit: Math.max(0, Number(shareLink.timeLimit) || 0),
    };
  }

  async deleteTest(
    testId: string,
    userId: string,
  ): Promise<{
    success: true;
    deletedTestId: string;
    deletedResultsCount: number;
    removedActiveBattlesCount: number;
  }> {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat test yaratuvchisi uni o'chira oladi");
    }

    const testObjectId = new Types.ObjectId(testId);
    await this.testShareLinkModel.deleteMany({
      testId: testObjectId,
      createdBy: new Types.ObjectId(userId),
    });
    const deletedResults = await this.battleHistoryModel.deleteMany({
      testId: testObjectId,
    });

    let removedActiveBattlesCount = 0;
    for (const [roomId, battle] of this.activeBattles.entries()) {
      if (battle.testId === testId) {
        this.activeBattles.delete(roomId);
        removedActiveBattlesCount += 1;
      }
    }

    await this.testModel.deleteOne({ _id: testObjectId }).exec();

    return {
      success: true,
      deletedTestId: testId,
      deletedResultsCount: deletedResults.deletedCount || 0,
      removedActiveBattlesCount,
    };
  }

  /* ---- FLASHCARDS (Anki-style) ---- */

  async createFlashcardDeck(
    userId: string,
    data: any,
  ): Promise<FlashcardDeckDocument> {
    if (data.cards && data.cards.length > 30) {
      throw new BadRequestException(
        'Lug‘atda so‘zlar soni 30 tadan oshmasligi kerak',
      );
    }

    const user = await this.usersService.findById(userId);
    const limit = getTierLimit(
      APP_LIMITS.flashcardsCreated,
      user?.premiumStatus,
    );

    const count = await this.flashcardModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta lug‘at yarata olasiz. Ko'proq imkoniyat uchun Premium sotib oling.`,
      );
    }

    const { title, cards } = this.validateFlashcardPayload(data);
    if (!title) {
      throw new BadRequestException('Lugat sarlavhasini kiriting');
    }
    if (cards.length === 0) {
      throw new BadRequestException("Kamida bitta to'g'ri karta kiriting");
    }
    const createdDeck = new this.flashcardModel({
      ...data,
      title,
      cards,
      urlSlug: await this.generateUniqueFlashcardDeckSlug(),
      createdBy: new Types.ObjectId(userId),
    });
    return createdDeck.save();
  }

  async updateFlashcardDeck(
    deckId: string,
    userId: string,
    data: any,
  ): Promise<FlashcardDeckDocument> {
    const deck = await this.findFlashcardDeckByIdentifier(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat lug'at yaratuvchisi uni tahrirlay oladi");
    }

    const { title, cards } = this.validateFlashcardPayload(data);

    if (!title) {
      throw new BadRequestException('Lugat sarlavhasini kiriting');
    }

    if (cards.length === 0) {
      throw new BadRequestException("Kamida bitta to'g'ri karta kiriting");
    }

    if (cards.length > 30) {
      throw new BadRequestException(
        'Lug‘atda so‘zlar soni 30 tadan oshmasligi kerak',
      );
    }

    deck.title = title;
    deck.cards = cards as any;
    deck.isPublic = data?.isPublic !== false;

    await this.ensureFlashcardDeckSlug(deck);

    return deck.save();
  }

  async deleteFlashcardDeck(
    deckId: string,
    userId: string,
  ): Promise<{
    success: true;
    deletedDeckId: string;
    deletedProgressCount: number;
  }> {
    const deck = await this.findFlashcardDeckByIdentifier(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat lug'at yaratuvchisi uni o'chira oladi");
    }

    const deckObjectId = new Types.ObjectId(deck._id);
    const deletedProgress = await this.progressModel.deleteMany({
      deckId: deckObjectId,
    });

    await this.flashcardModel.deleteOne({ _id: deckObjectId }).exec();

    return {
      success: true,
      deletedDeckId: deckId,
      deletedProgressCount: deletedProgress.deletedCount || 0,
    };
  }

  async getUserFlashcardDecks(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const query = {
      $or: [{ createdBy: userObjectId }, { 'members.userId': userObjectId }],
    };

    const [decks, total] = await Promise.all([
      this.flashcardModel
        .find(query)
        .populate('createdBy', 'nickname avatar')
        .populate('members.userId', 'nickname avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.flashcardModel.countDocuments(query),
    ]);

    await Promise.all(
      decks.map((deck) => this.ensureFlashcardDeckSlug(deck as any)),
    );

    return {
      data: decks.map((deck: any) => {
        const { __v, ...safeDeck } = deck.toObject ? deck.toObject() : deck;
        return safeDeck;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFlashcardDeckWithProgress(
    deckId: string,
    userId?: string,
  ): Promise<any> {
    const deck = await this.flashcardModel
      .findOne(this.buildFlashcardDeckIdentifierQuery(deckId))
      .populate('createdBy', 'nickname avatar')
      .populate('members.userId', 'nickname avatar');
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    await this.ensureFlashcardDeckSlug(deck as any);

    let progressList: FlashcardProgressDocument[] = [];
    if (userId) {
      progressList = await this.progressModel.find({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deck._id),
      });
    }

    // Merge cards with progress
    const cardsWithProgress = deck.cards.map((card: any) => {
      const progress = progressList.find(
        (p) => p.cardId === card._id.toString(),
      );
      return {
        ...card.toObject(),
        easeFactor: progress?.easeFactor || 2.5,
        interval: progress?.interval || 0,
        repetitions: progress?.repetitions || 0,
        nextReviewDate: progress?.nextReviewDate || new Date(),
      };
    });

    const { __v, ...safeDeck } = deck.toObject();

    return {
      ...safeDeck,
      cards: cardsWithProgress,
    };
  }

  async joinFlashcardDeck(
    deckId: string,
    userId: string,
  ): Promise<FlashcardDeckDocument> {
    const deck = await this.findFlashcardDeckByIdentifier(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    const userObjectId = new Types.ObjectId(userId);
    const isMember = deck.members.some((m) => m.userId.toString() === userId);
    const isCreator = deck.createdBy.toString() === userId;

    if (!isMember && !isCreator) {
      deck.members.push({ userId: userObjectId, joinedAt: new Date() });
      return deck.save();
    }
    return deck;
  }

  async leaveFlashcardDeck(
    deckId: string,
    userId: string,
  ): Promise<FlashcardDeckDocument> {
    const deck = await this.findFlashcardDeckByIdentifier(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    if (deck.createdBy.toString() === userId) {
      throw new ForbiddenException('Tuzuvchi o‘z lug‘atidan chiqa olmaydi');
    }

    deck.members = deck.members.filter((m) => m.userId.toString() !== userId);

    // Optional: cleanup progress when leaving
    await this.progressModel.deleteMany({
      userId: new Types.ObjectId(userId),
      deckId: new Types.ObjectId(deck._id),
    });

    return deck.save();
  }

  async reviewFlashcard(
    deckId: string,
    cardId: string,
    userId: string,
    quality: number,
  ): Promise<any> {
    const deck = await this.findFlashcardDeckByIdentifier(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    const card = deck.cards.find((c: any) => c._id.toString() === cardId);
    if (!card) throw new NotFoundException('Soz topilmadi');

    // SuperMemo-2 Spaced Repetition Logic
    let mappedQuality = 0;
    if (quality === 1) mappedQuality = 2;
    if (quality === 2) mappedQuality = 4;
    if (quality === 3) mappedQuality = 5;

    let progress = await this.progressModel.findOne({
      userId: new Types.ObjectId(userId),
      deckId: new Types.ObjectId(deck._id),
      cardId: cardId,
    });

    if (!progress) {
      progress = new this.progressModel({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deck._id),
        cardId: cardId,
      });
    }

    let { easeFactor, interval, repetitions } = progress;

    if (mappedQuality >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    easeFactor =
      easeFactor +
      (0.1 - (5 - mappedQuality) * (0.08 + (5 - mappedQuality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    progress.easeFactor = easeFactor;
    progress.interval = interval;
    progress.repetitions = repetitions;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    progress.nextReviewDate = nextDate;

    await progress.save();
    return progress;
  }

  /* ---- SENTENCE BUILDERS ---- */

  private formatSentenceBuilderDeck(
    deck: any,
    requestUserId?: string,
    options?: {
      showResults?: boolean;
      timeLimit?: number;
      shareShortCode?: string;
      shareGroupName?: string;
      sharePersistResults?: boolean;
    },
  ) {
    const creatorId =
      deck?.createdBy?._id?.toString?.() ||
      deck?.createdBy?.toString?.() ||
      String(deck?.createdBy || '');
    const canViewAnswers = creatorId === requestUserId;
    const showResults =
      typeof options?.showResults === 'boolean' ? options.showResults : true;
    const timeLimit = Math.max(0, Number(options?.timeLimit) || 0);

    return {
      ...deck,
      canViewAnswers,
      timeLimit,
      showResults,
      shareShortCode: options?.shareShortCode || null,
      shareGroupName: options?.shareGroupName || '',
      sharePersistResults: options?.sharePersistResults !== false,
      items: (deck?.items || []).map((item: any) => {
        if (canViewAnswers) {
          return item;
        }

        return {
          _id: item._id,
          prompt: item.prompt,
          poolTokens: this.shuffleTokens([
            ...(item.answerTokens || []),
            ...(item.extraTokens || []),
          ]),
        };
      }),
    };
  }

  async createSentenceBuilderDeck(
    userId: string,
    data: any,
  ): Promise<SentenceBuilderDeckDocument> {
    const items = String(data?.pattern || '').trim()
      ? this.parseSentenceBuilderPattern(data?.pattern)
      : this.normalizeSentenceBuilderItems(data?.items);

    if (!String(data?.title || '').trim()) {
      throw new BadRequestException('To‘plam nomi kiritilishi shart');
    }

    if (items.length === 0) {
      throw new BadRequestException(
        'Kamida bitta gap tuzish savolini kiriting',
      );
    }

    if (items.length > 30) {
      throw new BadRequestException(
        'Bir to‘plamda 30 tadan ortiq savol bo‘lishi mumkin emas',
      );
    }

    const user = await this.usersService.findById(userId);
    const limit = getTierLimit(
      APP_LIMITS.sentenceBuildersCreated,
      user?.premiumStatus,
    );

    const count = await this.sentenceBuilderModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta gap tuzish to‘plami yarata olasiz. Ko'proq imkoniyat uchun Premium sotib oling.`,
      );
    }

    const { title, description } = this.validateSentenceBuilderPayload(
      data,
      items,
    );

    const createdDeck = new this.sentenceBuilderModel({
      title,
      description,
      items,
      createdBy: new Types.ObjectId(userId),
      isPublic: data?.isPublic !== false,
    });

    return createdDeck.save();
  }

  async updateSentenceBuilderDeck(
    deckId: string,
    userId: string,
    data: any,
  ): Promise<SentenceBuilderDeckDocument> {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) {
      throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    }

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat to'plam yaratuvchisi uni tahrirlay oladi",
      );
    }

    const items = String(data?.pattern || '').trim()
      ? this.parseSentenceBuilderPattern(data?.pattern)
      : this.normalizeSentenceBuilderItems(data?.items);

    const { title, description } = this.validateSentenceBuilderPayload(
      data,
      items,
    );

    if (!title) {
      throw new BadRequestException('To‘plam nomi kiritilishi shart');
    }

    if (items.length === 0) {
      throw new BadRequestException(
        'Kamida bitta gap tuzish savolini kiriting',
      );
    }

    if (items.length > 30) {
      throw new BadRequestException(
        'Bir to‘plamda 30 tadan ortiq savol bo‘lishi mumkin emas',
      );
    }

    deck.title = title;
    deck.description = description;
    deck.items = items as any;
    deck.isPublic = data?.isPublic !== false;

    return deck.save();
  }

  async deleteSentenceBuilderDeck(
    deckId: string,
    userId: string,
  ): Promise<{ success: true; deletedDeckId: string }> {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) {
      throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    }

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat to'plam yaratuvchisi uni o'chira oladi",
      );
    }

    await this.sentenceBuilderShareLinkModel.deleteMany({
      deckId: new Types.ObjectId(deckId),
      createdBy: new Types.ObjectId(userId),
    });
    await this.sentenceBuilderAttemptModel.deleteMany({
      deckId: new Types.ObjectId(deckId),
    });
    await this.sentenceBuilderModel.deleteOne({
      _id: new Types.ObjectId(deckId),
    });

    return {
      success: true,
      deletedDeckId: deckId,
    };
  }

  async getUserSentenceBuilderDecks(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const query = { createdBy: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    const [decks, total] = await Promise.all([
      this.sentenceBuilderModel
        .find(query)
        .populate('createdBy', 'nickname username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.sentenceBuilderModel.countDocuments(query),
    ]);

    return {
      data: decks.map((deck) => this.formatSentenceBuilderDeck(deck, userId)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSentenceBuilderDeckById(id: string, requestUserId?: string) {
    const deck = await this.sentenceBuilderModel
      .findById(id)
      .populate('createdBy', 'nickname username avatar')
      .lean()
      .exec();

    if (!deck) {
      throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    }

    const creatorId =
      (deck.createdBy as any)?._id?.toString?.() || String(deck.createdBy);
    if (!deck.isPublic && creatorId !== requestUserId) {
      throw new ForbiddenException('Siz bu to‘plamni ko‘ra olmaysiz');
    }

    return this.formatSentenceBuilderDeck(deck, requestUserId);
  }

  async getSentenceBuilderDeckByShortCode(
    shortCode: string,
    requestUserId?: string,
  ) {
    const shareLink = await this.sentenceBuilderShareLinkModel
      .findOne({ shortCode: String(shortCode || '').trim().toLowerCase() })
      .lean()
      .exec();
    if (!shareLink) {
      throw new NotFoundException('Gap tuzish havolasi topilmadi');
    }

    const deck = await this.sentenceBuilderModel
      .findById(shareLink.deckId)
      .populate('createdBy', 'nickname username avatar')
      .lean()
      .exec();
    if (!deck) {
      throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    }

    return {
      deck: this.formatSentenceBuilderDeck(deck, requestUserId, {
        showResults: shareLink.showResults !== false,
        timeLimit: Math.max(0, Number(shareLink.timeLimit) || 0),
        shareShortCode: shareLink.shortCode,
        shareGroupName: shareLink.groupName,
        sharePersistResults: shareLink.persistResults !== false,
      }),
      shareLink: {
        shortCode: shareLink.shortCode,
        groupName: shareLink.groupName,
        persistResults: shareLink.persistResults !== false,
        showResults: shareLink.showResults !== false,
        timeLimit: Math.max(0, Number(shareLink.timeLimit) || 0),
      },
    };
  }

  async checkSentenceBuilderAnswer(
    deckId: string,
    questionIndex: number,
    selectedTokens: string[],
    requestUserId?: string,
  ) {
    const deck = await this.sentenceBuilderModel.findById(deckId).lean().exec();
    if (!deck) {
      throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    }

    const creatorId =
      (deck.createdBy as any)?._id?.toString?.() || String(deck.createdBy);
    if (!deck.isPublic && creatorId !== requestUserId) {
      throw new ForbiddenException('Siz bu to‘plamni ishlata olmaysiz');
    }

    const question = deck.items?.[Number(questionIndex)];
    if (!question) {
      throw new NotFoundException('Savol topilmadi');
    }

    const evaluation = this.evaluateSentenceBuilderAnswer(
      question.answerTokens || [],
      selectedTokens,
    );

    return evaluation;
  }

  async listSentenceBuilderShareLinks(deckId: string, userId: string) {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat to'plam yaratuvchisi linklarni ko'ra oladi",
      );
    }

    const links = await this.sentenceBuilderShareLinkModel
      .find({
        deckId: new Types.ObjectId(deckId),
        createdBy: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return links.map((link) => ({
      _id: link._id,
      shortCode: link.shortCode,
      groupName: link.groupName,
      persistResults: link.persistResults !== false,
      showResults: link.showResults !== false,
      timeLimit: Math.max(0, Number(link.timeLimit) || 0),
      createdAt: link.createdAt,
    }));
  }

  async createSentenceBuilderShareLink(
    deckId: string,
    userId: string,
    options: {
      persistResults?: boolean;
      groupName?: string;
      showResults?: boolean;
      timeLimit?: number;
    },
  ) {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat to'plam yaratuvchisi xavfsiz havola yarata oladi",
      );
    }

    const user = await this.usersService.findById(userId);
    const shareLimit = getTierLimit(
      APP_LIMITS.sentenceBuilderShareLinksPerDeck,
      user?.premiumStatus,
    );
    const currentCount = await this.sentenceBuilderShareLinkModel.countDocuments(
      {
        deckId: new Types.ObjectId(deckId),
        createdBy: new Types.ObjectId(userId),
      },
    );
    if (currentCount >= shareLimit) {
      throw new ForbiddenException(
        `Maksimal ${shareLimit} ta gap tuzish havolasi yaratishingiz mumkin`,
      );
    }

    const persistResults = options?.persistResults !== false;
    const groupName = persistResults
      ? this.normalizeShareGroupName(options?.groupName)
      : '';
    const showResults = options?.showResults !== false;
    const timeLimit = Math.max(0, Number(options?.timeLimit) || 0);

    if (persistResults && !groupName) {
      throw new BadRequestException('Guruh nomini kiriting');
    }

    const link = await this.sentenceBuilderShareLinkModel.create({
      deckId: new Types.ObjectId(deckId),
      createdBy: new Types.ObjectId(userId),
      shortCode: await this.generateUniqueShareCodeForModel(
        this.sentenceBuilderShareLinkModel,
      ),
      groupName,
      persistResults,
      showResults,
      timeLimit,
    });

    return {
      _id: link._id,
      shortCode: link.shortCode,
      persistResults: link.persistResults !== false,
      showResults: link.showResults !== false,
      timeLimit: Math.max(0, Number(link.timeLimit) || 0),
      groupName: link.groupName,
      createdAt: link.createdAt,
    };
  }

  async deleteSentenceBuilderShareLink(
    deckId: string,
    shareLinkId: string,
    userId: string,
  ) {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        "Faqat to'plam yaratuvchisi havolani o'chira oladi",
      );
    }

    const deleted = await this.sentenceBuilderShareLinkModel.findOneAndDelete({
      _id: new Types.ObjectId(shareLinkId),
      deckId: new Types.ObjectId(deckId),
      createdBy: new Types.ObjectId(userId),
    });
    if (!deleted) {
      throw new NotFoundException('Havola topilmadi');
    }

    await this.sentenceBuilderAttemptModel.deleteMany({
      shareLinkId: new Types.ObjectId(shareLinkId),
    });

    return { deleted: true, deletedShareLinkId: shareLinkId };
  }

  async getSentenceBuilderResults(
    deckId: string,
    userId: string,
    pagination: { page: number; limit: number; search?: string },
  ) {
    const deck = await this.sentenceBuilderModel.findById(deckId).exec();
    if (!deck) throw new NotFoundException('Gap tuzish to‘plami topilmadi');
    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException("Faqat to'plam yaratuvchisi natijalarni ko'ra oladi");
    }

    const { page, limit, search } = pagination;
    const skip = (page - 1) * limit;
    const query: any = { deckId: new Types.ObjectId(deckId) };
    if (search) {
      query.participantName = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.sentenceBuilderAttemptModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.sentenceBuilderAttemptModel.countDocuments(query),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async submitSentenceBuilderAttempt(
    deckId: string,
    payload: {
      answers?: { questionIndex: number; selectedTokens: string[] }[];
      guestName?: string;
      requestUserId?: string;
      requestUserName?: string;
      shareShortCode?: string;
    },
  ) {
    const deck = await this.sentenceBuilderModel.findById(deckId).lean().exec();
    if (!deck) throw new NotFoundException('Gap tuzish to‘plami topilmadi');

    const creatorId =
      (deck.createdBy as any)?._id?.toString?.() || String(deck.createdBy);
    if (!deck.isPublic && creatorId !== payload.requestUserId) {
      throw new ForbiddenException('Siz bu to‘plamni ishlata olmaysiz');
    }

    let shareLink: any = null;
    if (payload.shareShortCode) {
      shareLink = await this.sentenceBuilderShareLinkModel
        .findOne({
          shortCode: String(payload.shareShortCode || '').trim().toLowerCase(),
          deckId: new Types.ObjectId(deckId),
        })
        .lean()
        .exec();
      if (!shareLink) {
        throw new BadRequestException('Gap tuzish havolasi yaroqsiz');
      }
    }

    const answersMap = new Map<number, string[]>();
    for (const answer of payload.answers || []) {
      answersMap.set(
        Number(answer?.questionIndex),
        Array.isArray(answer?.selectedTokens) ? answer.selectedTokens : [],
      );
    }

    const evaluatedItems = (deck.items || []).map((item: any, index: number) => {
      const evaluation = this.evaluateSentenceBuilderAnswer(
        item.answerTokens || [],
        answersMap.get(index) || [],
      );
      return {
        questionIndex: index,
        prompt: item.prompt,
        selectedTokens: evaluation.actual,
        expectedTokens: evaluation.expected,
        isCorrect: evaluation.isCorrect,
        mistakes: evaluation.mistakes,
      };
    });

    const score = evaluatedItems.filter((item) => item.isCorrect).length;
    const total = evaluatedItems.length;
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    const showResults = shareLink
      ? shareLink.showResults !== false
      : true;
    const persistResults = shareLink
      ? shareLink.persistResults !== false
      : false;
    const groupName = shareLink ? this.normalizeShareGroupName(shareLink.groupName) : '';
    const participantName = payload.requestUserId
      ? payload.requestUserName || 'Foydalanuvchi'
      : payload.guestName || 'Mehmon';
    const displayName =
      persistResults && groupName
        ? `${participantName}(${groupName})`
        : participantName;

    if (persistResults) {
      await this.sentenceBuilderAttemptModel.create({
        deckId: new Types.ObjectId(deckId),
        shareLinkId: shareLink?._id ? new Types.ObjectId(shareLink._id) : null,
        participantUserId: payload.requestUserId
          ? new Types.ObjectId(payload.requestUserId)
          : null,
        participantName: displayName,
        groupName,
        score,
        total,
        accuracy,
        items: evaluatedItems,
      });
    }

    return {
      saved: persistResults,
      showResults,
      score,
      total,
      accuracy,
      items: showResults ? evaluatedItems : [],
    };
  }
}
