import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ActivationMembershipType } from './generate-activation-codes.dto';
import { TopUpAmount } from './generate-top-up-codes.dto';

export enum GeneratedCodeCategory {
  ACTIVATION = 'activation',
  TOP_UP = 'top-up',
  BENEFICIARY = 'beneficiary',
}

export enum GeneratedCodeStatus {
  AVAILABLE = 'available',
  USED = 'used',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

function normalizeOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  return normalizedValue || undefined;
}

function normalizeOptionalLowercaseString(value: unknown): unknown {
  const normalizedValue = normalizeOptionalString(value);

  return typeof normalizedValue === 'string'
    ? normalizedValue.toLowerCase()
    : normalizedValue;
}

export class GeneratedCodesQueryDto {
  @Transform(({ value }: { value: unknown }) => normalizeOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'search cannot exceed 100 characters',
  })
  search?: string;

  @Transform(({ value }: { value: unknown }) =>
    normalizeOptionalLowercaseString(value),
  )
  @IsOptional()
  @IsEnum(GeneratedCodeCategory, {
    message: 'category must be activation, top-up, or beneficiary',
  })
  category?: GeneratedCodeCategory;

  @Transform(({ value }: { value: unknown }) =>
    normalizeOptionalLowercaseString(value),
  )
  @IsOptional()
  @IsEnum(GeneratedCodeStatus, {
    message: 'status must be available, used, expired, or disabled',
  })
  status?: GeneratedCodeStatus;

  @Transform(({ value }: { value: unknown }) =>
    normalizeOptionalLowercaseString(value),
  )
  @IsOptional()
  @IsEnum(ActivationMembershipType, {
    message: 'activationType must be either basic or premium',
  })
  activationType?: ActivationMembershipType;

  @Type(() => Number)
  @IsOptional()
  @IsIn([TopUpAmount.PHP_200, TopUpAmount.PHP_500, TopUpAmount.PHP_1500], {
    message: 'topUpAmount must be 200, 500, or 1500',
  })
  topUpAmount?: TopUpAmount;

  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'page must be a whole number',
  })
  @Min(1, {
    message: 'page must be at least 1',
  })
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({
    message: 'limit must be a whole number',
  })
  @Min(1, {
    message: 'limit must be at least 1',
  })
  @Max(100, {
    message: 'limit cannot exceed 100',
  })
  limit = 20;
}
