import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ArenaService } from './arena.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  /* ---- TESTS ---- */

  @Post('tests')
  @UseGuards(JwtAuthGuard)
  createTest(@Request() req, @Body() body: any) {
    return this.arenaService.createTest(req.user._id.toString(), body);
  }

  @Patch('tests/:id')
  @UseGuards(JwtAuthGuard)
  updateTest(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.arenaService.updateTest(id, req.user._id.toString(), body);
  }

  @Get('tests')
  getAllTests() {
    return this.arenaService.getAllTests();
  }

  @UseGuards(JwtAuthGuard)
  @Get('tests/my')
  getUserTests(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.arenaService.getUserTests(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('tests/shared/:shortCode')
  getSharedTestByShortCode(@Request() req, @Param('shortCode') shortCode: string) {
    const userId = req.user?._id?.toString();
    return this.arenaService.getSharedTestByShortCode(shortCode, userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('tests/:id')
  getTestById(@Request() req, @Param('id') id: string) {
    // req.user may be undefined if no auth header sent (OptionalJwtAuthGuard allows this)
    const userId = req.user?._id?.toString();
    return this.arenaService.getTestById(id, userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('tests/:id/submit')
  submitAnswers(
    @Request() req,
    @Param('id') id: string,
    @Body('answers') answers: number[],
    @Body('shareShortCode') shareShortCode?: string,
  ) {
    // If not logged in, generate a temporary guest ID for validation
    const userId = req.user ? req.user._id.toString() : 'guest_' + Date.now();
    return this.arenaService.submitAnswers(id, userId, answers, shareShortCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tests/:id/results')
  getTestResults(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.arenaService.getResultsForTest(id, req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 30,
      search,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('tests/:id/share-links')
  @UseGuards(JwtAuthGuard)
  listTestShareLinks(@Request() req, @Param('id') id: string) {
    return this.arenaService.listTestShareLinks(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post('tests/:id/share-links')
  createTestShareLink(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      persistResults?: boolean;
      groupName?: string;
      showResults?: boolean;
      timeLimit?: number;
    },
  ) {
    return this.arenaService.createTestShareLink(id, req.user._id.toString(), {
      persistResults: body?.persistResults !== false,
      groupName: body?.groupName,
      showResults: body?.showResults !== false,
      timeLimit: Number(body?.timeLimit) || 0,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tests/:id/share-links/:shareLinkId')
  deleteTestShareLink(
    @Request() req,
    @Param('id') id: string,
    @Param('shareLinkId') shareLinkId: string,
  ) {
    return this.arenaService.deleteTestShareLink(
      id,
      shareLinkId,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tests/:id')
  deleteTest(@Request() req, @Param('id') id: string) {
    return this.arenaService.deleteTest(id, req.user._id.toString());
  }

  /* ---- FLASHCARDS ---- */

  @UseGuards(JwtAuthGuard)
  @Post('flashcards')
  createFlashcardDeck(@Request() req, @Body() body: any) {
    return this.arenaService.createFlashcardDeck(req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('flashcards/:id')
  updateFlashcardDeck(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.arenaService.updateFlashcardDeck(
      id,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('flashcards')
  getUserFlashcardDecks(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.arenaService.getUserFlashcardDecks(
      req.user._id.toString(),
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('flashcards/:id')
  getFlashcardDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.getFlashcardDeckWithProgress(
      id,
      req.user?._id?.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('flashcards/:id/join')
  joinFlashcardDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.joinFlashcardDeck(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete('flashcards/:id/leave')
  leaveFlashcardDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.leaveFlashcardDeck(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete('flashcards/:id')
  deleteFlashcardDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.deleteFlashcardDeck(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Patch('flashcards/:deckId/cards/:cardId/review')
  reviewFlashcard(
    @Request() req,
    @Param('deckId') deckId: string,
    @Param('cardId') cardId: string,
    @Body('quality') quality: number,
  ) {
    return this.arenaService.reviewFlashcard(
      deckId,
      cardId,
      req.user._id.toString(),
      quality,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('flashcard-folders')
  createFlashcardFolder(@Request() req, @Body() body: any) {
    return this.arenaService.createFlashcardFolder(
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('flashcard-folders/:id')
  updateFlashcardFolder(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.arenaService.updateFlashcardFolder(
      id,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('flashcard-folders')
  getUserFlashcardFolders(@Request() req) {
    return this.arenaService.getUserFlashcardFolders(req.user._id.toString());
  }

  @Get('flashcard-folders/:id')
  getFlashcardFolder(@Param('id') id: string) {
    return this.arenaService.getFlashcardFolderDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('flashcard-folders/:id/join')
  joinFlashcardFolder(@Request() req, @Param('id') id: string) {
    return this.arenaService.joinFlashcardFolder(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete('flashcard-folders/:id/leave')
  leaveFlashcardFolder(@Request() req, @Param('id') id: string) {
    return this.arenaService.leaveFlashcardFolder(id, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Delete('flashcard-folders/:id')
  deleteFlashcardFolder(@Request() req, @Param('id') id: string) {
    return this.arenaService.deleteFlashcardFolder(id, req.user._id.toString());
  }

  /* ---- SENTENCE BUILDERS ---- */

  @UseGuards(JwtAuthGuard)
  @Post('sentence-builders')
  createSentenceBuilderDeck(@Request() req, @Body() body: any) {
    return this.arenaService.createSentenceBuilderDeck(
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('sentence-builders/:id')
  updateSentenceBuilderDeck(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.arenaService.updateSentenceBuilderDeck(
      id,
      req.user._id.toString(),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sentence-builders')
  getUserSentenceBuilderDecks(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.arenaService.getUserSentenceBuilderDecks(
      req.user._id.toString(),
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('sentence-builders/shared/:shortCode')
  getSentenceBuilderShared(
    @Request() req,
    @Param('shortCode') shortCode: string,
  ) {
    return this.arenaService.getSentenceBuilderDeckByShortCode(
      shortCode,
      req.user?._id?.toString(),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('sentence-builders/:id')
  getSentenceBuilderDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.getSentenceBuilderDeckById(
      id,
      req.user?._id?.toString(),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('sentence-builders/:id/check')
  checkSentenceBuilderAnswer(
    @Request() req,
    @Param('id') id: string,
    @Body('questionIndex') questionIndex: number,
    @Body('selectedTokens') selectedTokens: string[],
  ) {
    return this.arenaService.checkSentenceBuilderAnswer(
      id,
      Number(questionIndex),
      selectedTokens,
      req.user?._id?.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sentence-builders/:id/results')
  getSentenceBuilderResults(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.arenaService.getSentenceBuilderResults(
      id,
      req.user._id.toString(),
      {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        search,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sentence-builders/:id/share-links')
  listSentenceBuilderShareLinks(@Request() req, @Param('id') id: string) {
    return this.arenaService.listSentenceBuilderShareLinks(
      id,
      req.user._id.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('sentence-builders/:id/share-links')
  createSentenceBuilderShareLink(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      persistResults?: boolean;
      groupName?: string;
      showResults?: boolean;
      timeLimit?: number;
    },
  ) {
    return this.arenaService.createSentenceBuilderShareLink(
      id,
      req.user._id.toString(),
      {
        persistResults: body?.persistResults !== false,
        groupName: body?.groupName,
        showResults: body?.showResults !== false,
        timeLimit: Number(body?.timeLimit) || 0,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sentence-builders/:id/share-links/:shareLinkId')
  deleteSentenceBuilderShareLink(
    @Request() req,
    @Param('id') id: string,
    @Param('shareLinkId') shareLinkId: string,
  ) {
    return this.arenaService.deleteSentenceBuilderShareLink(
      id,
      shareLinkId,
      req.user._id.toString(),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('sentence-builders/:id/submit')
  submitSentenceBuilderAttempt(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.arenaService.submitSentenceBuilderAttempt(id, {
      answers: body?.answers,
      guestName: body?.guestName,
      requestUserId: req.user?._id?.toString(),
      requestUserName: req.user
        ? req.user.nickname || req.user.username
        : undefined,
      shareShortCode: body?.shareShortCode,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sentence-builders/:id')
  deleteSentenceBuilderDeck(@Request() req, @Param('id') id: string) {
    return this.arenaService.deleteSentenceBuilderDeck(
      id,
      req.user._id.toString(),
    );
  }

  /* ---- MNEMONICS ---- */

  @UseGuards(OptionalJwtAuthGuard)
  @Get('mnemonics/leaderboard')
  getMnemonicLeaderboard(@Request() req, @Query('mode') mode?: string) {
    return this.arenaService.getMnemonicLeaderboard(
      String(mode || 'digits'),
      req.user?._id?.toString(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('mnemonics/result')
  saveMnemonicBestResult(@Request() req, @Body() body: any) {
    return this.arenaService.saveMnemonicBestResult(
      req.user._id.toString(),
      body,
    );
  }

  /* ---- BATTLES ---- */

  @UseGuards(OptionalJwtAuthGuard)
  @Post('battles/save-solo')
  async saveSoloBattle(
    @Request() req,
    @Body() body: any,
    @Body('guestName') guestName?: string,
  ) {
    const isGuest = !req.user;
    const userId = isGuest ? 'guest_' + Date.now() : req.user._id.toString();
    const baseNickname = isGuest
      ? guestName || 'Mehmon'
      : req.user.nickname || req.user.username;
    const shareConfig = await this.arenaService.resolveShareLinkByShortCode(
      String(body?.shareShortCode || '').trim() || undefined,
    );
    const groupName = shareConfig.groupName;
    const nickname = groupName
      ? `${baseNickname}(${groupName.replace(/[()]/g, '')})`
      : baseNickname;

    if (!shareConfig.persistResults) {
      return { saved: false };
    }

    const graded = await this.arenaService.submitAnswers(
      body.testId,
      userId,
      Array.isArray(body?.answers) ? body.answers.map((value: any) => Number(value)) : [],
      String(body?.shareShortCode || '').trim() || undefined,
      { includeHiddenResults: true },
    );

    return this.arenaService.saveBattleHistory({
      roomId: 'solo_' + Date.now() + '_' + userId,
      testId: body.testId,
      hostId: userId,
      mode: 'solo',
      participants: [
        {
          userId: userId,
          nickname: nickname,
          score: graded.score,
          total: graded.total,
          answers: Array.isArray(body?.answers) ? body.answers.map((value: any) => Number(value)) : [],
          results: graded.results,
        },
      ],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('battles/history')
  getUserBattleHistory(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.arenaService.getUserBattleHistory(req.user._id.toString(), {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('battles/active')
  getActiveBattles(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.arenaService.getActiveBattlesList({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }
}
