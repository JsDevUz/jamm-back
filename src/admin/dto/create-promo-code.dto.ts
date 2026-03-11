import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromoCodeDto {
  @Transform(({ value }) => String(value || '').trim().toUpperCase())
  @IsString()
  @MinLength(3)
  code: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validUntil: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxUses?: number | null;

  @IsOptional()
  @Transform(({ value }) => value !== false && value !== 'false')
  @IsBoolean()
  isActive?: boolean = true;
}
