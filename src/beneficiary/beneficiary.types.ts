export type BeneficiaryStatus =
  | "empty"
  | "incomplete"
  | "completed";

export type BeneficiaryRelationship =
  | "Spouse"
  | "Child"
  | "Parent"
  | "Sibling"
  | "Grandparent"
  | "Guardian"
  | "Other";

export interface Beneficiary {
  id: string;

  firstName: string;
  middleName: string | null;
  lastName: string;

  address: string;
  relationship: BeneficiaryRelationship;

  status: BeneficiaryStatus;

  accountType: "BENEFICIARY";
  canLogin: false;

  createdAt: string;
  updatedAt: string;
}

export interface BeneficiarySlot {
  id: string;

  slotNumber: number;

  firstName: string;
  middleName: string | null;
  lastName: string;

  address: string;
  relationship: BeneficiaryRelationship | "";

  status: BeneficiaryStatus;
}

export interface BeneficiariesResponse {
  beneficiaries: BeneficiarySlot[];

  maximumBeneficiaries: number;
  completedCount: number;

  accountActivatedAt: string | null;

  accessUnlocked: boolean;
}

export interface VerifyBeneficiaryUnlockCodeResponse {
  success: boolean;
  unlocked: boolean;
  message: string;
}

export interface CreateBeneficiaryInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;

  address: string;
  relationship: BeneficiaryRelationship;
}

export interface UpdateBeneficiaryInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;

  address?: string;
  relationship?: BeneficiaryRelationship;
}