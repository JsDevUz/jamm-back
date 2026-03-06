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
import { UsersService } from '../users/users.service';

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
    @InjectModel(BattleHistory.name)
    private battleHistoryModel: Model<BattleHistoryDocument>,
    @InjectModel(FlashcardProgress.name)
    private progressModel: Model<FlashcardProgressDocument>,
    private usersService: UsersService,
  ) {}

  private activeBattles: Map<string, BattleRoom> = new Map();

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
    const isPremium = user?.premiumStatus === 'active';
    const limit = isPremium ? 10 : 3;

    const count = await this.testModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta test yarata olasiz. Ko'proq imkoniyat uchun Premium sotib oling.`,
      );
    }

    const createdTest = new this.testModel({
      ...data,
      createdBy: new Types.ObjectId(userId),
    });
    return createdTest.save();
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
  ): Promise<{
    score: number;
    total: number;
    results: {
      questionIndex: number;
      correct: boolean;
      correctOptionIndex: number;
    }[];
  }> {
    const test = await this.testModel.findById(testId).exec();
    if (!test) throw new NotFoundException('Test topilmadi');

    const results = test.questions.map((q, i) => ({
      questionIndex: i,
      correct: q.correctOptionIndex === answers[i],
      correctOptionIndex: q.correctOptionIndex,
    }));

    const score = results.filter((r) => r.correct).length;

    return { score, total: test.questions.length, results };
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
    const isPremium = user?.premiumStatus === 'premium';
    const limit = isPremium ? 10 : 4;

    const count = await this.flashcardModel.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Siz maksimal ${limit} ta lug‘at yarata olasiz. Ko'proq imkoniyat uchun Premium sotib oling.`,
      );
    }

    const createdDeck = new this.flashcardModel({
      ...data,
      createdBy: new Types.ObjectId(userId),
    });
    return createdDeck.save();
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
      .findById(deckId)
      .populate('createdBy', 'nickname avatar')
      .populate('members.userId', 'nickname avatar');
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    let progressList: FlashcardProgressDocument[] = [];
    if (userId) {
      progressList = await this.progressModel.find({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deckId),
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
    const deck = await this.flashcardModel.findById(deckId);
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
    const deck = await this.flashcardModel.findById(deckId);
    if (!deck) throw new NotFoundException('Lugat topilmadi');

    if (deck.createdBy.toString() === userId) {
      throw new ForbiddenException('Tuzuvchi o‘z lug‘atidan chiqa olmaydi');
    }

    deck.members = deck.members.filter((m) => m.userId.toString() !== userId);

    // Optional: cleanup progress when leaving
    await this.progressModel.deleteMany({
      userId: new Types.ObjectId(userId),
      deckId: new Types.ObjectId(deckId),
    });

    return deck.save();
  }

  async reviewFlashcard(
    deckId: string,
    cardId: string,
    userId: string,
    quality: number,
  ): Promise<any> {
    const deck = await this.flashcardModel.findById(deckId);
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
      deckId: new Types.ObjectId(deckId),
      cardId: cardId,
    });

    if (!progress) {
      progress = new this.progressModel({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deckId),
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
}
