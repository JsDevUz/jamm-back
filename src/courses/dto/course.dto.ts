import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

class LessonMediaItemDto {
  @IsOptional()
  @IsString()
  mediaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonTitleChars)
  title?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(['direct', 'hls'])
  streamType?: 'direct' | 'hls';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  streamAssets?: string[];

  @IsOptional()
  @IsString()
  hlsKeyAsset?: string;
}

export class CreateCourseDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.courseNameChars)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.courseDescriptionChars)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.courseCategoryChars)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  lessonLanguage?: string;

  @IsOptional()
  @IsEnum(['ongoing', 'recorded'])
  deliveryType?: 'ongoing' | 'recorded';

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(['paid', 'free_request', 'free_open'])
  accessType?: 'paid' | 'free_request' | 'free_open';
}

export class CreateLessonDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonTitleChars)
  title: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonDescriptionChars)
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(['direct', 'hls'])
  streamType?: 'direct' | 'hls';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  streamAssets?: string[];

  @IsOptional()
  @IsString()
  hlsKeyAsset?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonMediaItemDto)
  @ArrayMaxSize(10)
  mediaItems?: LessonMediaItemDto[];

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonTitleChars)
  title?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonDescriptionChars)
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(['direct', 'hls'])
  streamType?: 'direct' | 'hls';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  streamAssets?: string[];

  @IsOptional()
  @IsString()
  hlsKeyAsset?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonMediaItemDto)
  @ArrayMaxSize(10)
  mediaItems?: LessonMediaItemDto[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notionUrl?: string;
}
