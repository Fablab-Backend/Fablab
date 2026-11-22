import { IsMongoId, IsOptional } from 'class-validator';

export class UploadFileDto {
  @IsOptional()
  @IsMongoId()
  resourceId?: string;
}