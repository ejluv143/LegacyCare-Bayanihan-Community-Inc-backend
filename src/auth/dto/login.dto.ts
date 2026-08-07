import { Transform } from 'class-transformer';

import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  /*
   * Do not trim or transform passwords.
   * Spaces can be valid password characters.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
