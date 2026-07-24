import type { MembershipType } from "../../generated/prisma/client";

export interface CreateMemberInput {
  firstName: string;

  middleName?: string;

  lastName: string;

  address: string;

  dateOfBirth: string;

  email?: string;

  phone: string;

  membershipType: MembershipType;

  /**
   * Plain-text activation code entered
   * by the member.
   */
  activationCode: string;

  /**
   * Sponsor's referral code.
   *
   * Public Registration:
   *   Entered by the user.
   *
   * Genealogy:
   *   Automatically supplied from the
   *   authenticated member.
   */
  sponsorReferralCode: string;

  username: string;

  password: string;

  confirmPassword: string;
}

export interface CreatedMember {
  id: string;

  membershipId: string;

  firstName: string;

  middleName?: string | null;

  lastName: string;

  address: string;

  dateOfBirth: string;

  email?: string | null;

  phone: string;

  username: string;

  membershipType: MembershipType;

  referralCode: string;

  referredById: string | null;

  sponsorMembershipId: string;

  sponsorReferralCode: string;

  memberSince: string;

  status: string;

  createdAt: string;

  updatedAt: string;
}