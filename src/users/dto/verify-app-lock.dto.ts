import { IsString, Matches } from 'class-validator';

export class VerifyAppLockDto {
  @IsString()
  @Matches(/^\d{4}$/, {
    message: "App paroli aynan 4 ta raqamdan iborat bo'lishi kerak",
  })
  pin: string;
}
