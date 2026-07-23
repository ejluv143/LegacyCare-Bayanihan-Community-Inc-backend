import { Transform } from 'class-transformer';

import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MembershipType } from '../../generated/prisma/client';

function trim(value: unknown): unknown {
  return typeof value === 'string'
    ? value.trim()
    : value;
}

function optionalTrim(
  value: unknown,
): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === ''
    ? undefined
    : trimmed;
}

function normalizeMembershipType(
  value: unknown,
): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
}

export class CreateMemberDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1, {
    message: 'firstName is required',
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
    message: 'lastName is required',
  })
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }) =>
    optionalTrim(value),
  )
  @IsOptional()
  @IsEmail(
    {},
    {
      message:
        'email must be a valid email address',
    },
  )
  @MaxLength(191)
  email?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(
    /^\+?[0-9][0-9\s()-]{7,20}$/,
    {
      message:
        'phone must be a valid phone number',
    },
  )
  phone!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(4, {
    message:
      'username must contain at least 4 characters',
  })
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'username may only contain letters, numbers, periods, underscores, and hyphens',
  })
  username!: string;

  /**
   * Passwords must not be trimmed or transformed.
   */
  @IsString()
  @MinLength(8, {
    message:
      'password must contain at least 8 characters',
  })
  @MaxLength(128, {
    message:
      'password must not exceed 128 characters',
  })
  password!: string;

  @Transform(({ value }) =>
    normalizeMembershipType(value),
  )
  @IsOptional()
  @IsEnum(MembershipType, {
    message:
      'membershipType must be BASIC or PREMIUM',
  })
  membershipType?: MembershipType;

  @Transform(({ value }) =>
    optionalTrim(value),
  )
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message:
      'sponsorReferralCode may only contain letters, numbers, and hyphens',
  })
  sponsorReferralCode?: string;
}