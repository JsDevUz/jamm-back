import { IsBoolean } from 'class-validator';

export class UpdateUserInstructorDto {
  @IsBoolean()
  isInstructor: boolean;
}
