import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
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
} from "class-validator";

import {
  SatelliteAccountRole,
  SatelliteBusinessType,
  SatelliteCivilStatus,
  SatelliteGender,
  SatelliteLevel,
} from "../../../generated/prisma/client";

function optionalTrim(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

function normalizeEnum(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().replace(/-/g, "_").toUpperCase();
}

export class UpdateSatelliteLocationDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  region?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  province?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  barangay?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  streetAddress?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;
}

export class UpdateSatelliteManagerDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  suffix?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  birthDate?: string;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteGender)
  gender?: SatelliteGender;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteCivilStatus)
  civilStatus?: SatelliteCivilStatus;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/)
  contactNumber?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/)
  alternateContactNumber?: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;
}

export class UpdateSatelliteGovernmentIdentificationDto {
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

export class UpdateSatelliteOperationDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  openingDate?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  coverageArea?: string;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  operatingHours?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maximumMembers?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercentage?: number;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}

export class UpdateSatellitePayoutAccountDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/)
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

export class UpdateSatelliteAccountDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/)
  username?: string;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteAccountRole)
  role?: SatelliteAccountRole;
}

export class UpdateSatellitePermissionsDto {
  @IsOptional()
  @IsBoolean()
  canRegisterMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  canActivateMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  canProcessClaims?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewGenealogy?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageBeneficiaries?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewTransactions?: boolean;
}

export class UpdateAdminSatelliteDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  satelliteName?: string;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteBusinessType)
  businessType?: SatelliteBusinessType;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteLevel)
  satelliteLevel?: SatelliteLevel;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatelliteLocationDto)
  location?: UpdateSatelliteLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatelliteManagerDto)
  manager?: UpdateSatelliteManagerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatelliteGovernmentIdentificationDto)
  governmentIdentification?: UpdateSatelliteGovernmentIdentificationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatelliteOperationDto)
  operation?: UpdateSatelliteOperationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatellitePayoutAccountDto)
  payoutAccount?: UpdateSatellitePayoutAccountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatelliteAccountDto)
  account?: UpdateSatelliteAccountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSatellitePermissionsDto)
  permissions?: UpdateSatellitePermissionsDto;
}