import { MembershipType } from '../../generated/prisma/client';

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
   * Activation code entered by the member.
   * The service will hash it before storing.
   */
  activationCode: string;

  /**
   * Sponsor's referral code.
   *
   * Public Registration:
   *   Comes from the registration form.
   *
   * Genealogy Add Member:
   *   Comes from the logged-in member automatically.
   */
  sponsorReferralCode: string;

  username: string;

  password: string;

  confirmPassword: string;
}
