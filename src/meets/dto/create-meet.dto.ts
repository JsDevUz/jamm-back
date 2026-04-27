import {
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class CreateMeetDto {
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  roomId: string;

  @IsString()
  @MaxLength(APP_TEXT_LIMITS.meetTitleChars)
  title: string;

  @IsBoolean()
  isPrivate: boolean;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lessonId?: string;
}

export class UpdateMeetPrivacyDto {
  @IsBoolean()
  isPrivate: boolean;
}
