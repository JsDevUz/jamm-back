import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class BulkStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  userIds: string[];
}
