import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class MarkAttendanceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  progressPercent?: number;
}

export class SetAttendanceStatusDto {
  @IsEnum(['present', 'late', 'absent'])
  status: 'present' | 'late' | 'absent';
}

export class UpsertLessonLinkedTestDto {
  @IsOptional()
  @IsString()
  linkedTestId?: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minimumScore?: number;

  @IsOptional()
  @IsBoolean()
  requiredToUnlock?: boolean;
}

export class SubmitLessonLinkedTestAttemptDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  answers?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  sentenceBuilderAnswers?: { questionIndex: number; selectedTokens: string[] }[];
}

export class UpsertLessonMaterialDto {
  @IsOptional()
  @IsString()
  materialId?: string;

  @IsString()
  @MaxLength(APP_TEXT_LIMITS.courseNameChars)
  title: string;

  @IsString()
  fileUrl: string;

  @IsString()
  fileName: string;

  @IsInt()
  @Min(1)
  fileSize: number;
}

export class UpsertLessonHomeworkDto {
  @IsOptional()
  @IsString()
  assignmentId?: string;

  @IsBoolean()
  enabled: boolean;

  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonTitleChars)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.lessonDescriptionChars)
  description?: string;

  @IsEnum(['text', 'audio', 'video', 'pdf', 'photo'])
  type: 'text' | 'audio' | 'video' | 'pdf' | 'photo';

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  maxScore: number;
}

export class SubmitLessonHomeworkDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.homeworkAnswerChars)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.homeworkLinkChars)
  link?: string;

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
  @IsEnum(['direct', 'hls'])
  streamType?: 'direct' | 'hls';

  @IsOptional()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  streamAssets?: string[];

  @IsOptional()
  @IsString()
  hlsKeyAsset?: string;
}

export class ReviewLessonHomeworkDto {
  @IsEnum(['reviewed', 'needs_revision'])
  status: 'reviewed' | 'needs_revision';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.homeworkAnswerChars)
  feedback?: string;
}

export class SetLessonOralAssessmentDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.homeworkAnswerChars)
  note?: string;
}

export class LessonCommentDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.messageChars)
  text: string;
}
