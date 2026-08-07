import type { BeneficiaryRelationship } from './beneficiary.types';

export const MAXIMUM_BENEFICIARIES = 4;

export const MAX_ID_GENERATION_ATTEMPTS = 5;

export const BENEFICIARY_RELATIONSHIPS = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Grandparent',
  'Guardian',
  'Other',
] as const satisfies readonly BeneficiaryRelationship[];

export const BENEFICIARY_ACCOUNT_TYPE = 'BENEFICIARY' as const;

export const BENEFICIARY_CAN_LOGIN = false as const;
