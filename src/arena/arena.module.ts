import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { ArenaGateway } from './arena.gateway';
import { Test, TestSchema } from './schemas/test.schema';
import { FlashcardDeck, FlashcardDeckSchema } from './schemas/flashcard.schema';
import {
  SentenceBuilderDeck,
  SentenceBuilderDeckSchema,
} from './schemas/sentence-builder.schema';
import {
  BattleHistory,
  BattleHistorySchema,
} from './schemas/battle-history.schema';
import {
  FlashcardProgress,
  FlashcardProgressSchema,
} from './schemas/flashcard-progress.schema';
import {
  TestShareLink,
  TestShareLinkSchema,
} from './schemas/test-share-link.schema';
import {
  SentenceBuilderShareLink,
  SentenceBuilderShareLinkSchema,
} from './schemas/sentence-builder-share-link.schema';
import {
  SentenceBuilderAttempt,
  SentenceBuilderAttemptSchema,
} from './schemas/sentence-builder-attempt.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Test.name, schema: TestSchema },
      { name: FlashcardDeck.name, schema: FlashcardDeckSchema },
      { name: SentenceBuilderDeck.name, schema: SentenceBuilderDeckSchema },
      { name: BattleHistory.name, schema: BattleHistorySchema },
      { name: FlashcardProgress.name, schema: FlashcardProgressSchema },
      { name: TestShareLink.name, schema: TestShareLinkSchema },
      {
        name: SentenceBuilderShareLink.name,
        schema: SentenceBuilderShareLinkSchema,
      },
      {
        name: SentenceBuilderAttempt.name,
        schema: SentenceBuilderAttemptSchema,
      },
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGateway],
})
export class ArenaModule {}
