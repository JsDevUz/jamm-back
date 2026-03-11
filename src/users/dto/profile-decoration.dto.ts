import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDecorationDto {
  @IsOptional()
  @IsString()
  decorationId?: string | null;
}
