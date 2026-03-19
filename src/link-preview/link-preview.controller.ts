import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LinkPreviewService } from './link-preview.service';

@Controller('link-preview')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  private sendHtml(res: Response, html: string) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('html');
    res.send(html);
  }

  @Get('groups/:identifier')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewGroup(
    @Param('identifier') identifier: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderGroupPreview(identifier);
    return this.sendHtml(res, html);
  }

  @Get('users/:identifier')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewUser(
    @Param('identifier') identifier: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderUserPreview(identifier);
    return this.sendHtml(res, html);
  }

  @Get('articles/:identifier')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArticle(
    @Param('identifier') identifier: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArticlePreview(identifier);
    return this.sendHtml(res, html);
  }

  @Get('courses/:courseId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewCourse(
    @Param('courseId') courseId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderCoursePreview(courseId);
    return this.sendHtml(res, html);
  }

  @Get('courses/:courseId/:lessonId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderCoursePreview(courseId, lessonId);
    return this.sendHtml(res, html);
  }

  @Get('join/:roomId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewMeet(
    @Param('roomId') roomId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderMeetPreview(roomId);
    return this.sendHtml(res, html);
  }

  @Get('arena/quiz-link/:resourceId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaQuizLink(
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArenaQuizPreview(
      resourceId,
      `/arena/quiz-link/${resourceId}`,
    );
    return this.sendHtml(res, html);
  }

  @Get('arena/quiz/:resourceId/:lessonId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaQuizLesson(
    @Param('resourceId') resourceId: string,
    @Param('lessonId') lessonId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArenaQuizPreview(
      resourceId,
      `/arena/quiz/${resourceId}/${lessonId}`,
      lessonId,
    );
    return this.sendHtml(res, html);
  }

  @Get('arena/quiz/:resourceId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaQuiz(
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArenaQuizPreview(
      resourceId,
      `/arena/quiz/${resourceId}`,
    );
    return this.sendHtml(res, html);
  }

  @Get('arena/flashcards/:resourceId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaFlashcards(
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArenaFlashcardPreview(
      resourceId,
      `/arena/flashcards/${resourceId}`,
    );
    return this.sendHtml(res, html);
  }

  @Get('arena/flashcard-folders/:resourceId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaFlashcardFolders(
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const html =
      await this.linkPreviewService.renderArenaFlashcardFolderPreview(
        resourceId,
        `/arena/flashcard-folders/${resourceId}`,
      );
    return this.sendHtml(res, html);
  }

  @Get('arena/sentence-builder/:resourceId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaSentenceBuilder(
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const html =
      await this.linkPreviewService.renderArenaSentenceBuilderPreview(
        resourceId,
        `/arena/sentence-builder/${resourceId}`,
      );
    return this.sendHtml(res, html);
  }

  @Get('arena/battle/:roomId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewArenaBattle(
    @Param('roomId') roomId: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderArenaBattlePreview(
      roomId,
      `/arena/battle/${roomId}`,
    );
    return this.sendHtml(res, html);
  }

  @Get(':slug')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async previewDirectSlug(
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const html = await this.linkPreviewService.renderDirectSlugPreview(slug, `/${slug}`);
    return this.sendHtml(res, html);
  }
}
