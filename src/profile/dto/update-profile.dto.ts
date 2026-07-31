import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/* =========================================================
   UPDATE PROFILE DTO
========================================================= */

export class UpdateProfileDto {
  /* =======================================================
     FIRST NAME
  ======================================================= */

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  /* =======================================================
     MIDDLE NAME
  ======================================================= */

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string | null;

  /* =======================================================
     LAST NAME
  ======================================================= */

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  /* =======================================================
     ADDRESS
  ======================================================= */

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null;

  /* =======================================================
     DATE OF BIRTH
     
     Frontend sends:
     YYYY-MM-DD
  ======================================================= */

  @IsOptional()
  @IsString()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
    {
      message:
        'Date of birth must use YYYY-MM-DD format.',
    },
  )
  dateOfBirth?: string | null;

  /* =======================================================
     EMAIL
  ======================================================= */

  @IsOptional()
  @IsEmail(
    {},
    {
      message:
        'Please provide a valid email address.',
    },
  )
  @MaxLength(191)
  email?: string | null;

  /* =======================================================
     PHONE
  ======================================================= */

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string;
}