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

import {
  MembershipType,
} from '../../generated/prisma/client';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'Username may only contain letters, numbers, periods, underscores, and hyphens.',
  })
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message:
      'Phone number must contain 10 to 15 digits and may begin with +.',
  })
  phone!: string;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType: MembershipType =
    MembershipType.BASIC;

  @IsOptional()
  @IsDateString()
  memberSince?: string;

  @IsOptional()
  @IsString()
  sponsorReferralCode?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}