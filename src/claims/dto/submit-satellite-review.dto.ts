import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
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

  @IsString()
  @MinLength(1, { message: 'remarks is required' })
  @MaxLength(2000)
  remarks!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SatelliteClaimDocumentReviewDto)
  documents?: SatelliteClaimDocumentReviewDto[];
}
