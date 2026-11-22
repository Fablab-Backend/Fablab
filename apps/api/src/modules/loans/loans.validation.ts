import {
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EquipmentCondition, LoanStatus } from './loans.model';

export class CreateLoanDto {
  @IsMongoId()
  equipmentId!: string;

  @IsDateString()
  dueAt!: string;

  @IsEnum(EquipmentCondition)
  conditionAtLoan!: EquipmentCondition;

  @IsOptional()
  @IsMongoId()
  borrowerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnLoanDto {
  @IsEnum(EquipmentCondition)
  conditionAtReturn!: EquipmentCondition;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class LoanQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(Object.values(LoanStatus))
  status?: LoanStatus;

  @IsOptional()
  @IsMongoId()
  equipmentId?: string;
}
