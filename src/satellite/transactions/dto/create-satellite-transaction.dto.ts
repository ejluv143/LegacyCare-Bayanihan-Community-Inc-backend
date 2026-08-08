import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

import {
  SatelliteTransactionDirection,
  SatelliteTransactionPaymentMethod,
  SatelliteTransactionType,
} from '../../../generated/prisma/client';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalTrimValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Admin-only. Records a satellite financial transaction that
 * happened off-platform -- there is no in-app payment collection, so
 * "creating" a code-purchase transaction means an admin confirming a
 * satellite paid (GCash, bank transfer, cash) and logging it.
 *
 * Claim payouts are created automatically (see
 * SatelliteTransactionsService.createClaimPayoutTransaction) and are
 * not expected to come through this endpoint, though nothing
 * technically prevents an admin from logging one manually too.
 */
export class CreateSatelliteTransactionDto {
  @IsUUID('4', { message: 'satelliteId must be a valid identifier' })
  satelliteId!: string;

  @IsEnum(SatelliteTransactionType)
  type!: SatelliteTransactionType;

  @IsEnum(SatelliteTransactionDirection)
  direction!: SatelliteTransactionDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'amount must be greater than zero' })
  amount!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee?: number;

  @IsEnum(SatelliteTransactionPaymentMethod)
  paymentMethod!: SatelliteTransactionPaymentMethod;

  @Transform(({ value }) => optionalTrimValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  referenceNumber?: string;

  @Transform(({ value }) => trimValue(value))
  @IsString()
  @MinLength(1, { message: 'description is required' })
  @MaxLength(2000)
  description!: string;

  @Transform(({ value }) => optionalTrimValue(value))
  @IsOptional()
  @IsUUID('4', { message: 'relatedMemberId must be a valid identifier' })
  relatedMemberId?: string;
}
