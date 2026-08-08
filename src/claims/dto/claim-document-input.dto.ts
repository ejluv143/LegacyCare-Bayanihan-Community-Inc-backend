import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

import { ClaimDocumentType } from '../../generated/prisma/enums';
import { MAX_CLAIM_DOCUMENT_BASE64_LENGTH } from '../claims.constants';

export class ClaimDocumentInputDto {
  @IsEnum(ClaimDocumentType, {
    message: 'Each document must have a recognized document type.',
  })
  type!: ClaimDocumentType;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(MAX_CLAIM_DOCUMENT_BASE64_LENGTH)
  @Matches(
    /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    {
      message: 'Each document must be a valid PDF, JPG, PNG, or WEBP file.',
    },
  )
  fileData!: string;
}
