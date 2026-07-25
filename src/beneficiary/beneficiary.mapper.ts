import type {
  Beneficiary,
  BeneficiaryRelationship,
  BeneficiarySlot,
  BeneficiaryStatus,
} from "./beneficiary.types";

interface BeneficiaryRecord {
  beneficiaryId: string;
  sequence: number;

  firstName: string;
  middleName: string | null;
  lastName: string;

  address: string;
  relationship: string;

  createdAt: Date;
  updatedAt: Date;
}

interface BeneficiaryStatusFields {
  firstName: string;
  lastName: string;
  address: string | null;
  relationship:
    | BeneficiaryRelationship
    | ""
    | null;
}

export function createEmptyBeneficiarySlot(
  slotNumber: number,
): BeneficiarySlot {
  return {
    id: `beneficiary-slot-${slotNumber}`,
    slotNumber,

    firstName: "",
    middleName: null,
    lastName: "",

    address: "",
    relationship: "",

    status: "empty",
  };
}

export function mapBeneficiarySlot(
  beneficiary: BeneficiaryRecord,
): BeneficiarySlot {
  const relationship =
    beneficiary.relationship as BeneficiaryRelationship;

  return {
    id: beneficiary.beneficiaryId,
    slotNumber: beneficiary.sequence,

    firstName: beneficiary.firstName,
    middleName: beneficiary.middleName,
    lastName: beneficiary.lastName,

    address: beneficiary.address,
    relationship,

    status: getBeneficiaryStatus({
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
      address: beneficiary.address,
      relationship,
    }),
  };
}

export function mapBeneficiary(
  beneficiary: BeneficiaryRecord,
): Beneficiary {
  const relationship =
    beneficiary.relationship as BeneficiaryRelationship;

  return {
    id: beneficiary.beneficiaryId,

    firstName: beneficiary.firstName,
    middleName: beneficiary.middleName,
    lastName: beneficiary.lastName,

    address: beneficiary.address,
    relationship,

    status: getBeneficiaryStatus({
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
      address: beneficiary.address,
      relationship,
    }),

    accountType: "BENEFICIARY",
    canLogin: false,

    createdAt: beneficiary.createdAt.toISOString(),
    updatedAt: beneficiary.updatedAt.toISOString(),
  };
}

export function getBeneficiaryStatus(
  beneficiary: BeneficiaryStatusFields,
): BeneficiaryStatus {
  const requiredFields = [
    beneficiary.firstName,
    beneficiary.lastName,
    beneficiary.address,
    beneficiary.relationship,
  ];

  const completedFields = requiredFields.filter(
    (field) =>
      typeof field === "string" &&
      field.trim().length > 0,
  ).length;

  if (completedFields === 0) {
    return "empty";
  }

  if (completedFields < requiredFields.length) {
    return "incomplete";
  }

  return "completed";
}