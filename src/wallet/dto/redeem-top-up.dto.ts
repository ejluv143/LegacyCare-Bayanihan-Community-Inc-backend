import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RedeemTopUpDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(3, {
    message: 'code is required',
  })
  @MaxLength(32)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'code may only contain letters, numbers, and hyphens',
  })
  code!: string;
}
