import { IsString, IsNumber, IsOptional, IsEnum, IsMongoId } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name!: string;

  @IsNumber()
  capacity!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  locationId?: string;
}

export class CreateEquipmentDto {
  @IsString()
  name!: string;

  @IsString()
  inventoryNumber!: string;

  @IsOptional()
  @IsEnum(['available', 'broken', 'maintenance'])
  state?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  locationId?: string;
}