import type {
  ClaimDocumentStatus,
  ClaimDocumentType,
  ClaimStatus,
  ClaimType,
} from '../generated/prisma/enums';

export interface ClaimDocumentResponse {
  id: string;
  type: Lowercase<ClaimDocumentType>;
  required: boolean;
  status: Lowercase<ClaimDocumentStatus>;
  fileName: string;
  mimeType: string;
  fileData: string;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedByAccount: string | null;
  reviewRemarks: string | null;
}

export interface ClaimStatusHistoryResponse {
  id: string;
  status: Lowercase<ClaimStatus>;
  title: string;
  description: string;
  actorType: string;
  actorName: string | null;
  createdAt: string;
}

export interface ClaimResponse {
  id: string;
  claimNumber: string;
  type: Lowercase<ClaimType>;
  status: Lowercase<ClaimStatus>;

  memberId: string;
  membershipId: string;
  memberName: string;
  membershipType: 'basic' | 'premium';

  satelliteId: string | null;
  satelliteName: string | null;

  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryRelationship: string;

  claimantName: string;
  claimantRelationship: string;
  claimantContactNumber: string;

  dateOfDeath: string;
  placeOfDeath: string;
  causeOfDeath: string;

  bankName: string;
  accountName: string;
  accountNumber: string;

  remarks: string | null;

  requestedAmount: number;
  approvedAmount: number | null;

  satelliteReviewedAt: string | null;
  satelliteReviewedByAccount: string | null;
  satelliteRemarks: string | null;

  forwardedToAdminAt: string | null;

  adminReviewedAt: string | null;
  adminReviewedByAdmin: string | null;
  adminRemarks: string | null;
  rejectionReason: string | null;

  paidAt: string | null;
  payoutReference: string | null;

  documents: ClaimDocumentResponse[];
  statusHistory: ClaimStatusHistoryResponse[];

  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimListResponse {
  success: true;
  message: string;
  claims: ClaimResponse[];
}

export interface ClaimDetailResponse {
  success: true;
  message: string;
  claim: ClaimResponse;
}
