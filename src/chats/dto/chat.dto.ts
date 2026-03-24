import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

class ChatAdminDto {
  @IsMongoId()
  userId: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  permissions: string[];
}

export class CreateChatDto {
  @IsBoolean()
  isGroup: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.groupNameChars)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.groupDescriptionChars)
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  memberIds: string[];
}

export class SendMessageDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.messageChars)
  content: string;

  @IsOptional()
  @IsMongoId()
  replayToId?: string;
}

export class EditMessageDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.messageChars)
  content: string;
}

export class EditChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.groupNameChars)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.groupDescriptionChars)
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  members?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAdminDto)
  admins?: ChatAdminDto[];
}

export class RequestJoinCallDto {
  @IsString()
  @MaxLength(APP_TEXT_LIMITS.nicknameChars)
  name: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;
}

export class RespondJoinRequestDto {
  @IsBoolean()
  approved: boolean;
}

export class UpdateChatPushNotificationsDto {
  @IsBoolean()
  enabled: boolean;
}
