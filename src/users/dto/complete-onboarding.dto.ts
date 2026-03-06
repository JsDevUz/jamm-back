import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  Matches,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty({ message: 'Username kiritilishi majburiy' })
  @Matches(/^[a-zA-Z0-9]{8,30}$/, {
    message:
      "Username kamida 8 ta belgidan iborat bo'lishi va faqat harf va raqamlardan tashkil topishi kerak",
  })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Jinsingizni tanlang' })
  gender: string;

  @Type(() => Number)
  @IsNumber({}, { message: "Yosh raqam bo'lishi kerak" })
  @Min(4, { message: "Yosh eng kamida 4 bo'lishi mumkin" })
  @Max(100, { message: "Yosh eng ko'pi 100 bo'lishi mumkin" })
  age: number;

  @IsArray()
  @IsOptional()
  interests?: string[];

  @IsArray()
  @IsOptional()
  goals?: string[];

  @IsString()
  @IsOptional()
  level?: string;
}
