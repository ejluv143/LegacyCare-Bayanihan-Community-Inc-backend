import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AdminClaimDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class SubmitAdminReviewDto {
  @IsEnum(AdminClaimDecision, {
    message: 'decision must be APPROVE or REJECT',
  })
  decision!: AdminClaimDecision;

  @IsString()
  @MinLength(1, { message: 'remarks is required' })
  @MaxLength(2000)
  remarks!: string;

  // Only used when decision = APPROVE. Defaults to the system-computed
  // requestedAmount when omitted.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedAmount?: number;
}
