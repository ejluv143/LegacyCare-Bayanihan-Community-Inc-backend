import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  AnnouncementPriority,
  AnnouncementType,
} from '../../generated/prisma/enums';

export class CreateAnnouncementDto {
  @IsOptional()
  @IsEnum(AnnouncementType, { message: 'type must be GENERAL or DEATH' })
  type?: AnnouncementType;

  @IsString()
  @MinLength(1, { message: 'title is required' })
  @MaxLength(191, { message: 'title cannot exceed 191 characters' })
  title!: string;

  @IsString()
  @MinLength(1, { message: 'description is required' })
  @MaxLength(500, { message: 'description cannot exceed 500 characters' })
  description!: string;

  @IsString()
  @MinLength(1, { message: 'content is required' })
  content!: string;

  @IsOptional()
  @IsEnum(AnnouncementPriority, {
    message: 'priority must be HIGH, NORMAL, or INFO',
  })
  priority?: AnnouncementPriority;

  @IsOptional()
  @IsString()
  @MaxLength(191, { message: 'postedBy cannot exceed 191 characters' })
  postedBy?: string;

  @IsOptional()
  @IsDateString({}, { message: 'publishAt must be a valid ISO 8601 date' })
  publishAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expiresAt must be a valid ISO 8601 date' })
  expiresAt?: string;

  // Required (and only meaningful) when type = DEATH; validated further in
  // AnnouncementsService against the actual member record.
  @ValidateIf(
    (dto: CreateAnnouncementDto) => dto.type === AnnouncementType.DEATH,
  )
  @IsUUID('4', { message: 'deceasedMemberId must be a valid member id' })
  deceasedMemberId?: string;
}
