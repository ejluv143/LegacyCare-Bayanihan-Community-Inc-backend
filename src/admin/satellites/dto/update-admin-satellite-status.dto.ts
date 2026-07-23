import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

import { SatelliteStatus } from "../../../generated/prisma/client";

function normalizeStatus(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().replace(/-/g, "_").toUpperCase();
}

function optionalTrim(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

export class UpdateAdminSatelliteStatusDto {
  @Transform(({ value }) => normalizeStatus(value))
  @IsEnum(SatelliteStatus)
  status!: SatelliteStatus;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}