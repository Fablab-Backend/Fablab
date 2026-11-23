import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string; // 'Campus', 'Bâtiment', 'Espace'

  @IsMongoId()
  organizationId!: string;

  @IsOptional()
  @IsString()
  description?: string;
}