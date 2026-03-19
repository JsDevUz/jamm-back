import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';
import { Chat, ChatSchema } from '../chats/schemas/chat.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Meet, MeetSchema } from '../meets/schemas/meet.schema';
import { Test, TestSchema } from '../arena/schemas/test.schema';
import {
  FlashcardDeck,
  FlashcardDeckSchema,
} from '../arena/schemas/flashcard.schema';
import {
  FlashcardFolder,
  FlashcardFolderSchema,
} from '../arena/schemas/flashcard-folder.schema';
import {
  SentenceBuilderDeck,
  SentenceBuilderDeckSchema,
} from '../arena/schemas/sentence-builder.schema';
import {
  TestShareLink,
  TestShareLinkSchema,
} from '../arena/schemas/test-share-link.schema';
import {
  SentenceBuilderShareLink,
  SentenceBuilderShareLinkSchema,
} from '../arena/schemas/sentence-builder-share-link.schema';
import {
  BattleHistory,
  BattleHistorySchema,
} from '../arena/schemas/battle-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Article.name, schema: ArticleSchema },
      { name: User.name, schema: UserSchema },
      { name: Meet.name, schema: MeetSchema },
      { name: Test.name, schema: TestSchema },
      { name: FlashcardDeck.name, schema: FlashcardDeckSchema },
      { name: FlashcardFolder.name, schema: FlashcardFolderSchema },
      { name: SentenceBuilderDeck.name, schema: SentenceBuilderDeckSchema },
      { name: TestShareLink.name, schema: TestShareLinkSchema },
      {
        name: SentenceBuilderShareLink.name,
        schema: SentenceBuilderShareLinkSchema,
      },
      { name: BattleHistory.name, schema: BattleHistorySchema },
    ]),
  ],
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService],
})
export class LinkPreviewModule {}
