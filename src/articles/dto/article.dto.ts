import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class UpsertArticleDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.articleTitleChars)
  title: string;

  @IsString()
  markdown: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.articleExcerptChars)
  excerpt?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @MaxLength(APP_TEXT_LIMITS.articleTagChars, { each: true })
  tags?: string[];
}

export class ArticleCommentDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.articleCommentChars)
  content: string;
}

export class ArticleReplyDto extends ArticleCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.usernameChars)
  replyToUser?: string;
}
