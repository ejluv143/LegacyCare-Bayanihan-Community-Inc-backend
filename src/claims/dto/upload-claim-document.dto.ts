import { IsString, Matches, MaxLength } from 'class-validator';

import { MAX_CLAIM_DOCUMENT_BASE64_LENGTH } from '../claims.constants';

export class UploadClaimDocumentDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(MAX_CLAIM_DOCUMENT_BASE64_LENGTH)
  @Matches(
    /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    {
      message: 'The document must be a valid PDF, JPG, PNG, or WEBP file.',
    },
  )
  fileData!: string;
}
