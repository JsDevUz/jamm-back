import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { ArenaGateway } from './arena.gateway';
import { Test, TestSchema } from './schemas/test.schema';
import { FlashcardDeck, FlashcardDeckSchema } from './schemas/flashcard.schema';
import {
  BattleHistory,
  BattleHistorySchema,
} from './schemas/battle-history.schema';
import {
  FlashcardProgress,
  FlashcardProgressSchema,
} from './schemas/flashcard-progress.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Test.name, schema: TestSchema },
      { name: FlashcardDeck.name, schema: FlashcardDeckSchema },
      { name: BattleHistory.name, schema: BattleHistorySchema },
      { name: FlashcardProgress.name, schema: FlashcardProgressSchema },
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGateway],
})
export class ArenaModule {}
