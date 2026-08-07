import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  SatelliteBusinessType,
  SatelliteCivilStatus,
  SatelliteGender,
  SatelliteLevel,
} from '../../../generated/prisma/client';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalTrim(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

function normalizeEnum(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/-/g, '_').toUpperCase();
}

export class CreateSatelliteLocationDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  region!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  province!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  city!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  barangay!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  streetAddress!: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;
}

export class CreateSatelliteManagerDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  suffix?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'birthDate must be a valid date',
    },
  )
  birthDate?: string;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteGender, {
    message: 'gender must be male, female, or prefer-not-to-say',
  })
  gender?: SatelliteGender;

  @Transform(({ value }) => normalizeEnum(value))
  @IsEnum(SatelliteCivilStatus, {
    message: 'civilStatus must be single, married, widowed, or separated',
  })
  civilStatus!: SatelliteCivilStatus;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nationality!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: 'contactNumber must be a valid phone number',
  })
  contactNumber!: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: 'alternateContactNumber must be a valid phone number',
  })
  alternateContactNumber?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail(
    {},
    {
      message: 'email must be a valid email address',
    },
  )
  @MaxLength(191)
  email!: string;
}

export class CreateSatelliteGovernmentIdentificationDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  validIdType?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  validIdNumber?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxIdentificationNumber?: string;
}

export class CreateSatelliteOperationDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'openingDate must be a valid date',
    },
  )
  openingDate?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  coverageArea!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  operatingHours!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maximumMembers!: number;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Max(100)
  commissionPercentage!: number;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}

export class CreateSatellitePayoutAccountDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: 'gcashNumber must be a valid phone number',
  })
  gcashNumber?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bankName?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  bankAccountName?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankAccountNumber?: string;
}

export class CreateSatelliteAccountDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      'username may only contain letters, numbers, periods, underscores, and hyphens',
  })
  username!: string;

  // Passwords must not be trimmed or transformed.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword!: string;
}

export class CreateSatellitePermissionsDto {
  @IsBoolean()
  canRegisterMembers!: boolean;

  @IsBoolean()
  canActivateMembers!: boolean;

  @IsBoolean()
  canProcessClaims!: boolean;

  @IsBoolean()
  canViewGenealogy!: boolean;

  @IsBoolean()
  canManageBeneficiaries!: boolean;

  @IsBoolean()
  canViewTransactions!: boolean;
}

export class CreateAdminSatelliteDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  satelliteName!: string;

  @Transform(({ value }) => normalizeEnum(value))
  @IsEnum(SatelliteBusinessType, {
    message: 'businessType must be franchise, company-owned, or affiliate',
  })
  businessType!: SatelliteBusinessType;

  @Transform(({ value }) => normalizeEnum(value))
  @IsEnum(SatelliteLevel, {
    message: 'satelliteLevel must be regional, provincial, city, or barangay',
  })
  satelliteLevel!: SatelliteLevel;

  @ValidateNested()
  @Type(() => CreateSatelliteLocationDto)
  location!: CreateSatelliteLocationDto;

  @ValidateNested()
  @Type(() => CreateSatelliteManagerDto)
  manager!: CreateSatelliteManagerDto;

  @ValidateNested()
  @Type(() => CreateSatelliteGovernmentIdentificationDto)
  governmentIdentification!: CreateSatelliteGovernmentIdentificationDto;

  @ValidateNested()
  @Type(() => CreateSatelliteOperationDto)
  operation!: CreateSatelliteOperationDto;

  @ValidateNested()
  @Type(() => CreateSatellitePayoutAccountDto)
  payoutAccount!: CreateSatellitePayoutAccountDto;

  @ValidateNested()
  @Type(() => CreateSatelliteAccountDto)
  account!: CreateSatelliteAccountDto;

  @ValidateNested()
  @Type(() => CreateSatellitePermissionsDto)
  permissions!: CreateSatellitePermissionsDto;
}
