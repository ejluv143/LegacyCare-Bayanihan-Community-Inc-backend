import { ClaimDocumentType, ClaimType } from '../generated/prisma/enums';

/**
 * Published death-benefit schedule (see the member Benefits page). Both
 * membership tiers currently share the same death-benefit amounts — Premium's
 * advantage is in hospitalization coverage, which claims don't cover.
 *
 * Tenure is measured from the member's activatedAt to the claim's
 * dateOfDeath. Thresholds are evaluated highest-first.
 */
export interface DeathBenefitTier {
  minimumTenureDays: number;
  amount: number;
}

export const DEATH_BENEFIT_SCHEDULE: Record<ClaimType, DeathBenefitTier[]> = {
  [ClaimType.NATURAL_DEATH]: [
    { minimumTenureDays: 300, amount: 60_000 }, // ~10 months
    { minimumTenureDays: 180, amount: 30_000 }, // 6 months
  ],
  [ClaimType.ACCIDENTAL_DEATH]: [
    { minimumTenureDays: 300, amount: 60_000 }, // ~10 months
    { minimumTenureDays: 1, amount: 30_000 }, // 24 hours
  ],
};

export interface RequiredClaimDocumentConfig {
  type: ClaimDocumentType;
  required: boolean;
}

export const REQUIRED_CLAIM_DOCUMENTS: RequiredClaimDocumentConfig[] = [
  { type: ClaimDocumentType.CLAIM_FORM, required: true },
  { type: ClaimDocumentType.DEATH_CERTIFICATE, required: true },
  { type: ClaimDocumentType.BARANGAY_CERTIFICATE, required: true },
  { type: ClaimDocumentType.VALID_ID, required: true },
  { type: ClaimDocumentType.MARRIAGE_OR_BIRTH_CERTIFICATE, required: true },
  { type: ClaimDocumentType.MEMBERSHIP_VERIFICATION, required: true },
  { type: ClaimDocumentType.MEDICAL_RECORDS, required: false },
  { type: ClaimDocumentType.AFFIDAVIT_OF_CLAIMANT, required: true },
  { type: ClaimDocumentType.BANK_ACCOUNT_DETAILS, required: true },
];

export const REQUIRED_DOCUMENT_TYPES: ClaimDocumentType[] =
  REQUIRED_CLAIM_DOCUMENTS.filter((document) => document.required).map(
    (document) => document.type,
  );

// ~1.2MB raw file, base64-encoded (base64 inflates size by ~4/3).
export const MAX_CLAIM_DOCUMENT_BASE64_LENGTH = 2_000_000;

export const ALLOWED_CLAIM_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_CLAIMS_PER_PAGE = 100;
