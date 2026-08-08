import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ClaimType } from '../../generated/prisma/enums';
import { ClaimDocumentInputDto } from './claim-document-input.dto';

export class CreateClaimDto {
  @IsEnum(ClaimType, {
    message: 'type must be NATURAL_DEATH or ACCIDENTAL_DEATH',
  })
  type!: ClaimType;

  @IsUUID('4', { message: 'beneficiaryId must be a valid beneficiary id' })
  beneficiaryId!: string;

  @IsString()
  @MinLength(1, { message: 'claimantName is required' })
  @MaxLength(191)
  claimantName!: string;

  @IsString()
  @MinLength(1, { message: 'claimantRelationship is required' })
  @MaxLength(100)
  claimantRelationship!: string;

  @IsString()
  @MinLength(1, { message: 'claimantContactNumber is required' })
  @MaxLength(30)
  claimantContactNumber!: string;

  @IsDateString({}, { message: 'dateOfDeath must be a valid date' })
  dateOfDeath!: string;

  @IsString()
  @MinLength(1, { message: 'placeOfDeath is required' })
  @MaxLength(255)
  placeOfDeath!: string;

  @IsString()
  @MinLength(1, { message: 'causeOfDeath is required' })
  @MaxLength(255)
  causeOfDeath!: string;

  @IsString()
  @MinLength(1, { message: 'bankName is required' })
  @MaxLength(150)
  bankName!: string;

  @IsString()
  @MinLength(1, { message: 'accountName is required' })
  @MaxLength(191)
  accountName!: string;

  @IsString()
  @MinLength(1, { message: 'accountNumber is required' })
  @MaxLength(100)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one supporting document is required.' })
  @ValidateNested({ each: true })
  @Type(() => ClaimDocumentInputDto)
  documents!: ClaimDocumentInputDto[];
}
