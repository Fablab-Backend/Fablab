import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Mise à jour groupée des paramètres de la plateforme. */
export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

/** Paramètres connus de la plateforme — tous optionnels. */
export class PlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  platformName?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  maxReservationDays?: number;
}
