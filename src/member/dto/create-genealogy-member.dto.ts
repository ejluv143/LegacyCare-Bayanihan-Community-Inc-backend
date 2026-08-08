import { Transform } from 'class-transformer';

import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MembershipType } from '../../generated/prisma/client';

function uppercaseTrimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateGenealogyMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'username may only contain letters, numbers, periods, underscores, and hyphens',
  })
  username!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => uppercaseTrimValue(value))
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'activationCode may only contain letters, numbers, and hyphens',
  })
  activationCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword?: string;

  /*
   * The member UI sends this display context with
   * the form. The service deliberately derives the
   * sponsor and final placement from the JWT/database.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  @IsOptional()
  @IsDateString()
  memberSince?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  sponsorId?: string;

  @IsOptional()
  @Transform(({ value }) => uppercaseTrimValue(value))
  @IsIn(['LEFT', 'RIGHT'])
  placement?: 'LEFT' | 'RIGHT';

  /**
   * Optional. When omitted, the servicing satellite is derived from
   * the activation code's assignment, falling back to a match against
   * the submitted address. See MembersService.resolveSatelliteId.
   */
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Satellite ID must be a valid identifier.',
  })
  satelliteId?: string;
}
