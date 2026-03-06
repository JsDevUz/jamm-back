import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: "Email formati noto'g'ri" })
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

  isVerified?: boolean;
  verificationToken?: string;
}
