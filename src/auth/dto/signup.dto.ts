import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  @Matches(/^[^\s@]+@gmail\.com$/i, {
    message: "Faqat gmail.com email manzili ruxsat etiladi",
  })
  email: string;

  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nickname kiritilishi shart' })
  nickname: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
