import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  SatelliteBusinessType,
  SatelliteStatus,
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

export class AdminSatellitesQueryDto {
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  search?: string;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteStatus)
  status?: SatelliteStatus;

  @Transform(({ value }) =>
    value === undefined ? undefined : normalizeEnum(value),
  )
  @IsOptional()
  @IsEnum(SatelliteBusinessType)
  businessType?: SatelliteBusinessType;

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

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn([
    "satelliteName",
    "satelliteCode",
    "status",
    "memberCount",
    "createdAt",
    "updatedAt",
  ])
  sortBy:
    | "satelliteName"
    | "satelliteCode"
    | "status"
    | "memberCount"
    | "createdAt"
    | "updatedAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "desc";
}