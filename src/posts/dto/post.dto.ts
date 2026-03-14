import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { APP_LIMITS, APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class PostImageDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'Rasm URL manzili noto‘g‘ri' },
  )
  url: string;

  @IsString()
  @MaxLength(40_000)
  blurDataUrl: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  height?: number;
}

export class UpsertPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.postCommentChars)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(APP_LIMITS.postImagesPerPost.premium)
  @ValidateNested({ each: true })
  @Type(() => PostImageDto)
  images?: PostImageDto[];
}

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
