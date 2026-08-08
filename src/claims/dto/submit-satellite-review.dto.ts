import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { ClaimDocumentStatus } from '../../generated/prisma/enums';

export enum SatelliteClaimDecision {
  FORWARD_TO_ADMIN = 'FORWARD_TO_ADMIN',
  REQUEST_CORRECTION = 'REQUEST_CORRECTION',
  REJECT = 'REJECT',
}

export class SatelliteClaimDocumentReviewDto {
  @IsUUID('4', { message: 'documentId must be a valid document id' })
  documentId!: string;

  @IsEnum(ClaimDocumentStatus)
  status!: ClaimDocumentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class SubmitSatelliteReviewDto {
  @IsEnum(SatelliteClaimDecision, {
    message: 'decision must be FORWARD_TO_ADMIN, REQUEST_CORRECTION, or REJECT',
  })
  decision!: SatelliteClaimDecision;

  /*
   * Not enforced as non-empty here -- remarks are optional when
   * forwarding a fully-verified claim (nothing to explain), but
   * required when requesting a correction or rejecting. That
   * decision-dependent rule is enforced in
   * ClaimsService.submitSatelliteReview instead, alongside the
   * similar required-document-verification rule.
   */
  @IsString()
  @MaxLength(2000)
  remarks!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SatelliteClaimDocumentReviewDto)
  documents?: SatelliteClaimDocumentReviewDto[];
}
