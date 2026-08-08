import { IsString, MaxLength, MinLength } from 'class-validator';

export class MarkClaimPaidDto {
  @IsString()
  @MinLength(1, { message: 'payoutReference is required' })
  @MaxLength(191)
  payoutReference!: string;
}
