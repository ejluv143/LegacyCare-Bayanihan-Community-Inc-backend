import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { MembershipType } from "../../generated/prisma/client";

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
      "username may only contain letters, numbers, periods, underscores, and hyphens",
  })
  username!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{7,20}$/, {
    message: "phone must be a valid phone number",
  })
  phone!: string;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message:
      "activationCode may only contain letters, numbers, and hyphens",
  })
  activationCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  confirmPassword!: string;
}