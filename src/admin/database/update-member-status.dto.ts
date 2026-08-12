import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Mirrors the frontend's AdminMemberStatus union. This is intentionally
// its own small string union rather than the Prisma MemberStatus enum:
// the frontend never sends "pending_activation" or "disabled", and
// "deceased" is not an admin-selectable value at all — it is only ever
// set by AnnouncementsService.processDeathAssessment.
export const MEMBER_STATUS_INPUTS = [
  'pending',
  'active',
  'suspended',
  'inactive',
] as const;

export type MemberStatusInput = (typeof MEMBER_STATUS_INPUTS)[number];

function normalizeStatus(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function optionalTrim(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

export class UpdateMemberStatusDto {
  @Transform(({ value }) => normalizeStatus(value))
  @IsIn(MEMBER_STATUS_INPUTS, {
    message: 'status must be one of: pending, active, suspended, inactive',
  })
  status!: MemberStatusInput;

  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
