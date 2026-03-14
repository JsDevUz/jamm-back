import { IsEmail, Matches } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  @Matches(/^[^\s@]+@(gmail\.com|jamm\.uz)$/i, {
    message: "Faqat gmail.com yoki jamm.uz email manzili ruxsat etiladi",
  })
  email: string;
}
