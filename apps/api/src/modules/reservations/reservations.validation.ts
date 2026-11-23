import { IsMongoId, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ReservationStatus } from './reservations.model';

export class CreateReservationDto {
  @IsMongoId()
  resourceId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}