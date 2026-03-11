import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class PostContentDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.postCommentChars)
  content: string;
}

export class PostReplyDto extends PostContentDto {
  @IsOptional()
  @IsMongoId()
  replyToUser?: string;
}
