import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MembershipType } from '../../generated/prisma/client';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalTrimValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function lowercaseTrimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function optionalLowercaseTrimValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim().toLowerCase();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function uppercaseTrimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class AddGenealogyMemberDto {
  @Transform(({ value }) => trimValue(value))
  @IsString()
  @MinLength(1, {
    message: 'First name is required.',
  })
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }) => optionalTrimValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @Transform(({ value }) => trimValue(value))
  @IsString()
  @MinLength(1, {
    message: 'Last name is required.',
  })
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }) => trimValue(value))
  @IsString()
  @MinLength(5, {
    message: 'Address must contain at least 5 characters.',
  })
  @MaxLength(500)
  address!: string;

  @IsDateString(
    {},
    {
      message: 'Date of birth must be a valid date.',
    },
  )
  dateOfBirth!: string;

  @Transform(({ value }) => optionalLowercaseTrimValue(value))
  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'Email must be a valid email address.',
    },
  )
  @MaxLength(191)
  email?: string;

  @Transform(({ value }) => trimValue(value))
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: 'CP number must be a valid phone number.',
  })
  phone!: string;

  @Transform(({ value }) => uppercaseTrimValue(value))
  @IsEnum(MembershipType, {
    message: 'Membership type must be valid.',
  })
  membershipType!: MembershipType;

  @Transform(({ value }) => uppercaseTrimValue(value))
  @IsString()
  @MinLength(6, {
    message: 'Activation code must contain at least 6 characters.',
  })
  @MaxLength(40)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'Activation code may only contain letters, numbers, and hyphens.',
  })
  activationCode!: string;

  @Transform(({ value }) => lowercaseTrimValue(value))
  @IsString()
  @MinLength(4, {
    message: 'Username must contain at least 4 characters.',
  })
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      'Username may only contain letters, numbers, periods, underscores, and hyphens.',
  })
  username!: string;

  @IsString()
  @MinLength(6, {
    message: 'Password must contain at least 6 characters.',
  })
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(6, {
    message: 'Confirm password must contain at least 6 characters.',
  })
  @MaxLength(128)
  confirmPassword!: string;
}
