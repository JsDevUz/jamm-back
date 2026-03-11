import { IsBoolean, IsString, MaxLength } from 'class-validator';
import { APP_TEXT_LIMITS } from '../../common/limits/app-limits';

export class CreateMeetDto {
  @IsString()
  roomId: string;

  @IsString()
  @MaxLength(APP_TEXT_LIMITS.meetTitleChars)
  title: string;

  @IsBoolean()
  isPrivate: boolean;
}
