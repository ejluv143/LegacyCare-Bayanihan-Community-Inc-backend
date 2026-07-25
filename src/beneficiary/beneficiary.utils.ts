import {
  MAXIMUM_BENEFICIARIES,
} from "./beneficiary.constants";

export function findAvailableSequence(
  usedSequences: number[],
): number | null {
  for (
    let sequence = 1;
    sequence <= MAXIMUM_BENEFICIARIES;
    sequence += 1
  ) {
    if (!usedSequences.includes(sequence)) {
      return sequence;
    }
  }

  return null;
}

export function createBeneficiaryId(
  primaryMembershipId: string,
  sequence: number,
): string {
  const sequenceText = String(sequence).padStart(
    2,
    "0",
  );

  return `${primaryMembershipId}-B${sequenceText}`;
}

export function normalizeOptionalText(
  value?: string | null,
): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue || null;
}

export function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}