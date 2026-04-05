import { BadRequestException } from '@nestjs/common';

export const APP_LIMITS = {
  presenceTtlSeconds: 30,
  promoDefaultDurationDays: 30,
  premiumPlanDurations: {
    monthly: 30,
    quarterly: 90,
    semiAnnual: 180,
    annual: 365,
  },
  postsPerDay: { ordinary: 10, premium: 20 },
  postCommentsPerPost: { ordinary: 5, premium: 10 },
  postImagesPerPost: { ordinary: 0, premium: 3 },
  postFeedPageSize: 15,
  postCommentsPageSize: 10,
  postLikedPageSize: 50,
  articlesPerUser: { ordinary: 10, premium: 30 },
  articleCommentsPerArticle: { ordinary: 5, premium: 10 },
  articleImagesPerArticle: { ordinary: 2, premium: 5 },
  articleWords: { ordinary: 1000, premium: 2000 },
  articleFeedPageSize: 20,
  articleCommentsPageSize: 10,
  articleLikedPageSize: 50,
  articleUploadThrottleLimit: 20,
  articleUploadThrottleTtlMs: 60_000,
  groupsCreated: { ordinary: 3, premium: 6 },
  groupsJoined: { ordinary: 10, premium: 20 },
  meetsCreated: { ordinary: 2, premium: 4 },
  meetParticipants: { ordinary: 10, premium: 40 },
  coursesCreated: { ordinary: 2, premium: 6 },
  lessonsPerCourse: { ordinary: 10, premium: 30 },
  lessonVideosPerLesson: { ordinary: 1, premium: 3 },
  testsCreated: { ordinary: 30, premium: 100 },
  testShareLinksPerTest: { ordinary: 2, premium: 4 },
  testsPerDeck: { ordinary: 30, premium: 50 },
  flashcardsCreated: { ordinary: 30, premium: 100 },
  flashcardsPerDeck: { ordinary: 30, premium: 50 },
  flashcardDeckPageSize: 20,
  sentenceBuildersCreated: { ordinary: 30, premium: 100 },
  sentenceBuilderShareLinksPerDeck: { ordinary: 2, premium: 4 },
  sentenceBuilderItemsPerDeck: { ordinary: 30, premium: 50 },
  lessonMediaBytes: 200 * 1024 * 1024,
  lessonHomeworkPerLesson: { ordinary: 1, premium: 3 },
  lessonTestsPerLesson: { ordinary: 1, premium: 1 },
  homeworkPhotoBytes: 10 * 1024 * 1024,
  postImageBytes: 5 * 1024 * 1024,
  homeworkAudioBytes: 20 * 1024 * 1024,
  homeworkVideoBytes: 100 * 1024 * 1024,
  homeworkPdfBytes: 20 * 1024 * 1024,
} as const;

export const APP_TEXT_LIMITS = {
  postWords: 100,
  postCommentChars: 400,
  articleCommentChars: 400,
  articleTitleChars: 120,
  articleExcerptChars: 220,
  articleTagChars: 24,
  articleTagCount: 8,
  groupNameChars: 60,
  groupDescriptionChars: 240,
  messageChars: 400,
  meetTitleChars: 80,
  meetDescriptionChars: 240,
  courseNameChars: 120,
  courseDescriptionChars: 500,
  courseCategoryChars: 40,
  lessonTitleChars: 120,
  lessonDescriptionChars: 1000,
  homeworkAnswerChars: 2000,
  homeworkLinkChars: 300,
  testTitleChars: 120,
  testDescriptionChars: 300,
  testQuestionChars: 240,
  testOptionChars: 140,
  flashcardTitleChars: 120,
  flashcardSideChars: 220,
  sentenceBuilderTitleChars: 120,
  sentenceBuilderDescriptionChars: 300,
  sentenceBuilderPromptChars: 240,
  sentenceBuilderAnswerChars: 240,
  sentenceBuilderTokenChars: 40,
  usernameChars: 24,
  nicknameChars: 30,
  bioChars: 160,
  shareGroupNameChars: 40,
} as const;

export function isPremiumStatus(status?: string | null) {
  return status === 'active' || status === 'premium';
}

export function getTierLimit(
  limits: { ordinary: number; premium: number },
  status?: string | null,
) {
  return isPremiumStatus(status) ? limits.premium : limits.ordinary;
}

export function countWords(value?: string | null) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function countMarkdownImages(value?: string | null) {
  return Array.from(
    String(value || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g),
  ).length;
}

export function assertMaxChars(
  label: string,
  value: string | undefined | null,
  maxChars: number,
) {
  const normalized = String(value || '');
  if (normalized.length > maxChars) {
    throw new BadRequestException(
      `${label} maksimal ${maxChars} ta belgidan oshmasligi kerak`,
    );
  }
}

export function assertMaxWords(
  label: string,
  value: string | undefined | null,
  maxWords: number,
) {
  if (countWords(value) > maxWords) {
    throw new BadRequestException(
      `${label} maksimal ${maxWords} ta so'zdan oshmasligi kerak`,
    );
  }
}

export function startOfCurrentDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
