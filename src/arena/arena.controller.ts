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
  ) {
    // If not logged in, generate a temporary guest ID for validation
    const userId = req.user ? req.user._id.toString() : 'guest_' + Date.now();
    return this.arenaService.submitAnswers(id, userId, answers);
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

  /* ---- FLASHCARDS ---- */

  @UseGuards(JwtAuthGuard)
  @Post('flashcards')
  createFlashcardDeck(@Request() req, @Body() body: any) {
    return this.arenaService.createFlashcardDeck(req.user._id.toString(), body);
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

  /* ---- BATTLES ---- */

  @UseGuards(OptionalJwtAuthGuard)
  @Post('battles/save-solo')
  saveSoloBattle(
    @Request() req,
    @Body() body: any,
    @Body('guestName') guestName?: string,
  ) {
    const isGuest = !req.user;
    const userId = isGuest ? 'guest_' + Date.now() : req.user._id.toString();
    const nickname = isGuest
      ? guestName || 'Mehmon'
      : req.user.nickname || req.user.username;

    return this.arenaService.saveBattleHistory({
      roomId: 'solo_' + Date.now() + '_' + userId,
      testId: body.testId,
      hostId: userId,
      mode: 'solo',
      participants: [
        {
          userId: userId,
          nickname: nickname,
          score: body.score,
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
