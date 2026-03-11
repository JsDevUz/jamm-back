import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AdminListDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  q?: string = '';

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsIn(['active', 'expired', 'none'])
  premiumStatus?: string;

  @IsOptional()
  @IsBooleanString()
  isBlocked?: string;

  @IsOptional()
  @IsIn(['public', 'private', 'free_open'])
  accessType?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
