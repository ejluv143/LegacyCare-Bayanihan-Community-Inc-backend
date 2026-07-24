import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { MembershipType } from "../../generated/prisma/client";

function trim(value: unknown): unknown {
  return typeof value === "string"
    ? value.trim()
    : value;
}

function optionalTrim(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function lowercaseTrim(value: unknown): unknown {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : value;
}

function uppercaseTrim(value: unknown): unknown {
  return typeof value === "string"
    ? value.trim().toUpperCase()
    : value;
}

function optionalUppercaseTrim(
  value: unknown,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim().toUpperCase();

  return trimmed || undefined;
}

export class CreateMemberDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1, {
    message: "firstName is required",
  })
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }) =>
    optionalTrim(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1, {
    message: "lastName is required",
  })
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(5, {
    message:
      "address must contain at least 5 characters",
  })
  @MaxLength(500)
  address!: string;

  @IsDateString(
    {},
    {
      message:
        "dateOfBirth must be a valid date",
    },
  )
  dateOfBirth!: string;

  @Transform(({ value }) =>
    lowercaseTrim(value),
  )
  @IsEmail(
    {},
    {
      message:
        "email must be a valid email address",
    },
  )
  @MaxLength(191)
  email!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message:
      "phone must be a valid phone number",
  })
  phone!: string;

  @Transform(({ value }) =>
    lowercaseTrim(value),
  )
  @IsString()
  @MinLength(4, {
    message:
      "username must contain at least 4 characters",
  })
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      "username may only contain letters, numbers, periods, underscores, and hyphens",
  })
  username!: string;

  @Transform(({ value }) =>
    uppercaseTrim(value),
  )
  @IsEnum(MembershipType, {
    message:
      "membershipType must be BASIC or PREMIUM",
  })
  membershipType!: MembershipType;

  /**
   * Validate this against GeneratedCode in the
   * service. Never store its plaintext value on
   * the Member record.
   */
  @Transform(({ value }) =>
    uppercaseTrim(value),
  )
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "activationCode may only contain letters, numbers, and hyphens",
  })
  activationCode!: string;

  /**
   * Public registration:
   * May be omitted.
   *
   * Genealogy registration:
   * Automatically supplied from the selected
   * sponsor's referral code.
   */
  @Transform(({ value }) =>
    optionalUppercaseTrim(value),
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "sponsorReferralCode may only contain letters, numbers, and hyphens",
  })
  sponsorReferralCode?: string;

  /**
   * Passwords must not be trimmed or transformed.
   */
  @IsString()
  @MinLength(8, {
    message:
      "password must contain at least 8 characters",
  })
  @MaxLength(128, {
    message:
      "password must not exceed 128 characters",
  })
  password!: string;

  @IsString()
  @MinLength(8, {
    message:
      "confirmPassword must contain at least 8 characters",
  })
  @MaxLength(128, {
    message:
      "confirmPassword must not exceed 128 characters",
  })
  confirmPassword!: string;
}