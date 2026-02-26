import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email: string;

  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Username kiritilishi shart' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Nickname kiritilishi shart' })
  nickname: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefon raqam kiritilishi shart' })
  phone: string;
}
