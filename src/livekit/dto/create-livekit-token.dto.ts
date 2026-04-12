import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLivekitTokenDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{4,128}$/)
  roomId: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  participantName?: string;

  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @IsOptional()
  @IsBoolean()
  canPublishData?: boolean;

  @IsOptional()
  @IsBoolean()
  canSubscribe?: boolean;
}
