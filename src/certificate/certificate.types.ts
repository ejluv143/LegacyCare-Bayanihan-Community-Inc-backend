export type CertificateStatus = 'active' | 'pending' | 'expired' | 'revoked';

export type CertificateMembershipType = 'basic' | 'premium';

export type CertificateBeneficiaryPosition = 1 | 2 | 3 | 4 | 5;

export interface CertificateBeneficiaryResponse {
  id: string;
  position: CertificateBeneficiaryPosition;
  fullName: string;
}

export interface CertificateResponse {
  certificateNumber: string;

  status: CertificateStatus;

  dateIssued: string | null;
  validUntil: string | null;

  memberName: string;
  membershipId: string;
  membershipType: CertificateMembershipType;
  memberSince: string | null;

  beneficiaries: CertificateBeneficiaryResponse[];

  authorizedBy: string;
  authorizedPosition: string;
  authorizedSignature: string | null;

  verificationCode: string;
  verificationUrl: string;
  qrCode: string | null;
}
