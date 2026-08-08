import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { SatelliteTransactionStatus } from '../../../generated/prisma/client';

function optionalTrimValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export class UpdateSatelliteTransactionStatusDto {
  @IsEnum(SatelliteTransactionStatus)
  status!: SatelliteTransactionStatus;

  @Transform(({ value }) => optionalTrimValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminRemarks?: string;
}
