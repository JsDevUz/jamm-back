import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, {
    message: "Nickname kamida 3 ta belgidan iborat bo'lishi kerak",
  })
  @MaxLength(APP_TEXT_LIMITS.nicknameChars, {
    message: "Nickname ko'pi bilan 30 ta belgidan iborat bo'lishi kerak",
  })
  nickname?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: "Username kamida 8 ta belgidan iborat bo'lishi kerak",
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Username faqat harf va sonlardan tashkil topishi kerak',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami +998XXXXXXXXX formatida bo'lishi kerak",
  })
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.bioChars, {
    message: `Haqida (Bio) ko'pi bilan ${APP_TEXT_LIMITS.bioChars} ta belgidan iborat bo'lishi kerak`,
  })
  bio?: string;

  @IsOptional()
  @IsBoolean()
  disableGroupInvites?: boolean;
}
