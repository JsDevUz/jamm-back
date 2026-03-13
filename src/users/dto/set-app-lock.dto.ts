import { IsOptional, IsString, Matches } from 'class-validator';

export class SetAppLockDto {
  @IsString()
  @Matches(/^\d{4}$/, {
    message: "App paroli aynan 4 ta raqamdan iborat bo'lishi kerak",
  })
  pin: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, {
    message: "Joriy app paroli aynan 4 ta raqamdan iborat bo'lishi kerak",
  })
  currentPin?: string;
}
