import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class UpsertBlogDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.blogTitleChars)
  title: string;

  @IsString()
  markdown: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.blogExcerptChars)
  excerpt?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @MaxLength(APP_TEXT_LIMITS.blogTagChars, { each: true })
  tags?: string[];
}

export class BlogCommentDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.blogCommentChars)
  content: string;
}

export class BlogReplyDto extends BlogCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.usernameChars)
  replyToUser?: string;
}
