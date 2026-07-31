import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/* =========================================================
   UPDATE PROFILE CREDENTIALS DTO
========================================================= */

export class UpdateProfileCredentialsDto {
  /* =======================================================
     USERNAME
  ======================================================= */

  @IsString()
  @MinLength(4)
  @MaxLength(50)
  username!: string;

  /* =======================================================
     CURRENT PASSWORD
  ======================================================= */

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  currentPassword!: string;

  /* =======================================================
     NEW PASSWORD
  ======================================================= */

  /*
   * Empty string is allowed when the user
   * only wants to change the username.
   *
   * The service will validate password length
   * only when a password change is requested.
   */

  @IsString()
  @MaxLength(255)
  newPassword!: string;

  /* =======================================================
     CONFIRM PASSWORD
  ======================================================= */

  @IsString()
  @MaxLength(255)
  confirmPassword!: string;
}