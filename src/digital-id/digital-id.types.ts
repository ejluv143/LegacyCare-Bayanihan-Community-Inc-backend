import { MemberStatus, MembershipType } from '../generated/prisma/client';

/* =========================================================
   MEMBERSHIP LEVEL
========================================================= */

export type DigitalIdMembershipLevel = 'basic' | 'premium';

/* =========================================================
   MEMBERSHIP STATUS
========================================================= */

export type DigitalIdMembershipStatus =
  'active' | 'pending' | 'suspended' | 'inactive';

/* =========================================================
   DIGITAL ID MEMBERSHIP
========================================================= */

export interface DigitalIdMembershipResponse {
  membershipId: string;

  level: DigitalIdMembershipLevel;

  status: DigitalIdMembershipStatus;

  activationDate: string | null;

  expirationDate: string | null;
}

/* =========================================================
   MEMBER
========================================================= */

export interface DigitalIdMemberResponse {
  id: string;

  firstName: string;

  middleName: string | null;

  lastName: string;

  fullName: string;

  mobileNumber: string;

  email: string | null;

  profilePhoto: string | null;

  qrCode: string | null;

  membership: DigitalIdMembershipResponse;
}

/* =========================================================
   DIGITAL ID DATA
========================================================= */

export interface DigitalIdDataResponse {
  member: DigitalIdMemberResponse;
}

/* =========================================================
   BENEFICIARY POSITION
========================================================= */

export type DigitalIdBeneficiaryPosition = 1 | 2 | 3 | 4 | 5;

/* =========================================================
   BENEFICIARY
========================================================= */

export interface DigitalIdBeneficiaryResponse {
  id: string;

  position: DigitalIdBeneficiaryPosition;

  firstName: string;

  middleName: string | null;

  lastName: string;

  fullName: string;

  relationship: string;

  address: string | null;
}

/* =========================================================
   BRANDING
========================================================= */

export interface DigitalIdBrandingResponse {
  organizationName: string;

  serviceName: string;

  tagline: string;

  logo: string;

  shield: string;
}

/* =========================================================
   BENEFIT
========================================================= */

export interface DigitalIdBenefitResponse {
  id: string;

  title: string;

  subtitle?: string;

  amount?: string;

  grocery?: string;
}

/* =========================================================
   REMINDER
========================================================= */

export interface DigitalIdReminderResponse {
  id: string;

  text: string;
}

/* =========================================================
   CONTACT INFORMATION
========================================================= */

export interface DigitalIdContactResponse {
  officeAddress: string;

  contactPerson: string;

  contactNumber: string;

  website: string;

  email: string;
}

/* =========================================================
   VALIDITY
========================================================= */

export interface DigitalIdValidityResponse {
  activationDate: string | null;

  expirationDate: string | null;

  membershipId: string;

  membershipLevel: DigitalIdMembershipLevel;

  membershipStatus: DigitalIdMembershipStatus;
}

/* =========================================================
   VERIFICATION
========================================================= */

export interface DigitalIdVerificationResponse {
  qrCode: string | null;

  verificationCode: string;

  verificationUrl: string;
}

/* =========================================================
   COMPLETE DIGITAL ID RESPONSE
========================================================= */

export interface DigitalIdResponse {
  digitalId: DigitalIdDataResponse;

  branding: DigitalIdBrandingResponse;

  benefits: DigitalIdBenefitResponse[];

  beneficiaries: DigitalIdBeneficiaryResponse[];

  reminders: DigitalIdReminderResponse[];

  contact: DigitalIdContactResponse;

  validity: DigitalIdValidityResponse;

  verification: DigitalIdVerificationResponse;

  fallbackMemberPhoto: string;
}

/* =========================================================
   MEMBERSHIP TYPE MAPPER
========================================================= */

export function mapMembershipType(
  membershipType: MembershipType,
): DigitalIdMembershipLevel {
  switch (membershipType) {
    case MembershipType.PREMIUM:
      return 'premium';

    case MembershipType.BASIC:
    default:
      return 'basic';
  }
}

/* =========================================================
   MEMBER STATUS MAPPER
========================================================= */

export function mapMemberStatus(
  status: MemberStatus,
): DigitalIdMembershipStatus {
  switch (status) {
    case MemberStatus.ACTIVE:
      return 'active';

    case MemberStatus.PENDING_ACTIVATION:
      return 'pending';

    case MemberStatus.SUSPENDED:
      return 'suspended';

    case MemberStatus.DISABLED:
    default:
      return 'inactive';
  }
}
