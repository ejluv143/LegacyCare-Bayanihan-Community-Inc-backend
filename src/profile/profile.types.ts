import {
  MemberStatus,
  MembershipType,
} from '../generated/prisma/client';

/* =========================================================
   PROFILE MEMBERSHIP TYPE
========================================================= */

export type ProfileMembershipType =
  | 'basic'
  | 'premium';

/* =========================================================
   PROFILE MEMBER STATUS
========================================================= */

export type ProfileMemberStatus =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'inactive';

/* =========================================================
   PROFILE MEMBERSHIP RESPONSE
========================================================= */

export interface ProfileMembershipResponse {
  membershipId: string;

  membershipType:
    ProfileMembershipType;

  memberSince:
    string | null;

  status:
    ProfileMemberStatus;
}

/* =========================================================
   PROFILE RESPONSE
========================================================= */

export interface ProfileResponse {
  /* =======================================================
     MEMBER IDENTITY
  ======================================================= */

  id: string;

  firstName: string;

  middleName:
    string | null;

  lastName: string;

  fullName: string;

  username: string;

  /* =======================================================
     PERSONAL INFORMATION
  ======================================================= */

  address:
    string | null;

  dateOfBirth:
    string | null;

  /* =======================================================
     CONTACT INFORMATION
  ======================================================= */

  email:
    string | null;

  phone: string;

  /* =======================================================
     PROFILE PHOTO
  ======================================================= */

  profilePhoto:
    string | null;

  /* =======================================================
     MEMBERSHIP INFORMATION
  ======================================================= */

  membership:
    ProfileMembershipResponse;
}

/* =========================================================
   MEMBERSHIP TYPE MAPPER
========================================================= */

/*
 * Prisma:
 *
 * BASIC   -> basic
 * PREMIUM -> premium
 *
 * Frontend receives lowercase values.
 */

export function mapProfileMembershipType(
  membershipType: MembershipType,
): ProfileMembershipType {
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

/*
 * Prisma:
 *
 * ACTIVE             -> active
 * PENDING_ACTIVATION -> pending
 * SUSPENDED          -> suspended
 * DISABLED           -> inactive
 */

export function mapProfileMemberStatus(
  status: MemberStatus,
): ProfileMemberStatus {
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