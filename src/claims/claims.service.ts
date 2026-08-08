import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { Decimal } from '@prisma/client/runtime/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { PrismaService } from '../admin/database/prisma/prisma.service';

import type { Prisma } from '../generated/prisma/client';
import type {
  Claim,
  ClaimDocument,
  ClaimStatusHistory,
} from '../generated/prisma/client';
import {
  ClaimDocumentStatus,
  ClaimDocumentType,
  ClaimStatus,
  ClaimType,
  MemberStatus,
} from '../generated/prisma/enums';

import {
  DEATH_BENEFIT_SCHEDULE,
  MAX_CLAIMS_PER_PAGE,
  REQUIRED_CLAIM_DOCUMENTS,
  REQUIRED_DOCUMENT_TYPES,
} from './claims.constants';
import { CreateClaimDto } from './dto/create-claim.dto';
import {
  SatelliteClaimDecision,
  SubmitSatelliteReviewDto,
} from './dto/submit-satellite-review.dto';
import {
  AdminClaimDecision,
  SubmitAdminReviewDto,
} from './dto/submit-admin-review.dto';
import { MarkClaimPaidDto } from './dto/mark-claim-paid.dto';
import { UploadClaimDocumentDto } from './dto/upload-claim-document.dto';
import type { ClaimResponse } from './claims.types';

const MAX_CLAIM_NUMBER_ATTEMPTS = 3;

type ClaimWithRelations = Claim & {
  member: {
    membershipId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    membershipType: string;
  };
  beneficiary: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    relationship: string;
  };
  satellite: { satelliteName: string } | null;
  documents: ClaimDocument[];
  statusHistory: ClaimStatusHistory[];
};

const claimInclude = {
  member: {
    select: {
      membershipId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      membershipType: true,
    },
  },
  beneficiary: {
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      relationship: true,
    },
  },
  satellite: {
    select: { satelliteName: true },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ClaimInclude;

function buildFullName(
  firstName: string,
  middleName: string | null,
  lastName: string,
): string {
  return [firstName, middleName, lastName]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(' ');
}

function parseDataUri(dataUri: string): { mimeType: string; fileData: string } {
  const match = /^data:([^;]+);base64,/.exec(dataUri);

  if (!match) {
    throw new BadRequestException('Document data is not a valid file.');
  }

  return { mimeType: match[1], fileData: dataUri };
}

function calculateTenureDays(activatedAt: Date, dateOfDeath: Date): number {
  const diffMs = dateOfDeath.getTime() - activatedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function calculateDeathBenefitAmount(
  type: ClaimType,
  activatedAt: Date,
  dateOfDeath: Date,
): number {
  const tenureDays = calculateTenureDays(activatedAt, dateOfDeath);

  const tier = DEATH_BENEFIT_SCHEDULE[type].find(
    (candidate) => tenureDays >= candidate.minimumTenureDays,
  );

  if (!tier) {
    throw new BadRequestException(
      'This member has not yet met the minimum membership tenure required for this benefit.',
    );
  }

  return tier.amount;
}

function mapMembershipType(value: string): 'basic' | 'premium' {
  return value === 'PREMIUM' ? 'premium' : 'basic';
}

@Injectable()
export class ClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     MEMBER-FACING
  ========================================================= */

  async getMemberClaims(memberId: string): Promise<ClaimResponse[]> {
    const claims = await this.prisma.claim.findMany({
      where: { memberId },
      include: claimInclude,
      orderBy: { submittedAt: 'desc' },
      take: MAX_CLAIMS_PER_PAGE,
    });

    return claims.map((claim) => this.toResponse(claim));
  }

  async getMemberClaimById(
    memberId: string,
    claimId: string,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, memberId },
      include: claimInclude,
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    return this.toResponse(claim);
  }

  async createClaim(
    memberId: string,
    dto: CreateClaimDto,
  ): Promise<ClaimResponse> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        status: true,
        activatedAt: true,
        satelliteId: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member account was not found.');
    }

    if (
      member.status === MemberStatus.SUSPENDED ||
      member.status === MemberStatus.DISABLED ||
      member.status === MemberStatus.DECEASED
    ) {
      throw new ForbiddenException(
        'Your member account is not eligible to file claims.',
      );
    }

    if (!member.activatedAt) {
      throw new BadRequestException(
        'Your membership must be activated before filing a claim.',
      );
    }

    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: dto.beneficiaryId, primaryMemberId: memberId },
      select: { id: true },
    });

    if (!beneficiary) {
      throw new NotFoundException(
        'The selected beneficiary was not found on your account.',
      );
    }

    const dateOfDeath = new Date(dto.dateOfDeath);

    const requestedAmount = calculateDeathBenefitAmount(
      dto.type,
      member.activatedAt,
      dateOfDeath,
    );

    this.assertRequiredDocumentsPresent(dto.documents.map((doc) => doc.type));

    for (let attempt = 1; attempt <= MAX_CLAIM_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const claimNumber = await this.generateClaimNumber(transaction);

          const claim = await transaction.claim.create({
            data: {
              claimNumber,
              type: dto.type,
              status: ClaimStatus.SUBMITTED,
              memberId,
              beneficiaryId: dto.beneficiaryId,
              satelliteId: member.satelliteId,
              claimantName: dto.claimantName.trim(),
              claimantRelationship: dto.claimantRelationship.trim(),
              claimantContactNumber: dto.claimantContactNumber.trim(),
              dateOfDeath,
              placeOfDeath: dto.placeOfDeath.trim(),
              causeOfDeath: dto.causeOfDeath.trim(),
              bankName: dto.bankName.trim(),
              accountName: dto.accountName.trim(),
              accountNumber: dto.accountNumber.trim(),
              remarks: dto.remarks?.trim() || null,
              requestedAmount: new Decimal(requestedAmount),
              documents: {
                create: dto.documents.map((document) => {
                  const { mimeType, fileData } = parseDataUri(
                    document.fileData,
                  );

                  return {
                    type: document.type,
                    required: REQUIRED_DOCUMENT_TYPES.includes(document.type),
                    status: ClaimDocumentStatus.PENDING,
                    fileName: document.fileName.trim(),
                    mimeType,
                    fileData,
                  };
                }),
              },
              statusHistory: {
                create: {
                  status: ClaimStatus.SUBMITTED,
                  title: 'Claim submitted',
                  description:
                    'The claim was submitted and is awaiting satellite office review.',
                  actorType: 'member',
                  actorId: memberId,
                },
              },
            },
            include: claimInclude,
          });

          return this.toResponse(claim);
        });
      } catch (error: unknown) {
        const isDuplicateClaimNumber =
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002';

        if (!isDuplicateClaimNumber || attempt === MAX_CLAIM_NUMBER_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new InternalServerErrorException(
      'The claim could not be submitted. Please try again.',
    );
  }

  async uploadMemberClaimDocument(
    memberId: string,
    claimId: string,
    type: ClaimDocumentType,
    dto: UploadClaimDocumentDto,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, memberId },
      select: { id: true, status: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    if (
      claim.status !== ClaimStatus.SUBMITTED &&
      claim.status !== ClaimStatus.SATELLITE_REVIEW &&
      claim.status !== ClaimStatus.NEEDS_CORRECTION
    ) {
      throw new ConflictException(
        'Documents can only be uploaded while a claim is awaiting or undergoing satellite review.',
      );
    }

    const { mimeType, fileData } = parseDataUri(dto.fileData);

    await this.prisma.claimDocument.upsert({
      where: { claimId_type: { claimId, type } },
      create: {
        claimId,
        type,
        required: REQUIRED_DOCUMENT_TYPES.includes(type),
        status: ClaimDocumentStatus.PENDING,
        fileName: dto.fileName.trim(),
        mimeType,
        fileData,
      },
      update: {
        status: ClaimDocumentStatus.PENDING,
        fileName: dto.fileName.trim(),
        mimeType,
        fileData,
        reviewedAt: null,
        reviewedByAccount: null,
        reviewRemarks: null,
      },
    });

    return this.getMemberClaimById(memberId, claimId);
  }

  async resubmitMemberClaim(
    memberId: string,
    claimId: string,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, memberId },
      select: { id: true, status: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    if (claim.status !== ClaimStatus.NEEDS_CORRECTION) {
      throw new ConflictException(
        'Only claims marked as needing correction can be resubmitted.',
      );
    }

    await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.SATELLITE_REVIEW,
        statusHistory: {
          create: {
            status: ClaimStatus.SATELLITE_REVIEW,
            title: 'Claim resubmitted',
            description:
              'The member resubmitted corrected documents for satellite review.',
            actorType: 'member',
            actorId: memberId,
          },
        },
      },
    });

    return this.getMemberClaimById(memberId, claimId);
  }

  async cancelMemberClaim(
    memberId: string,
    claimId: string,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, memberId },
      select: { id: true, status: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    const cancellableStatuses: ClaimStatus[] = [
      ClaimStatus.SUBMITTED,
      ClaimStatus.SATELLITE_REVIEW,
      ClaimStatus.NEEDS_CORRECTION,
    ];

    if (!cancellableStatuses.includes(claim.status)) {
      throw new ConflictException(
        'This claim can no longer be cancelled once it has been forwarded to the administrator.',
      );
    }

    await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.CANCELLED,
        statusHistory: {
          create: {
            status: ClaimStatus.CANCELLED,
            title: 'Claim cancelled',
            description: 'The member cancelled this claim.',
            actorType: 'member',
            actorId: memberId,
          },
        },
      },
    });

    return this.getMemberClaimById(memberId, claimId);
  }

  /* =========================================================
     SATELLITE-FACING
  ========================================================= */

  async getSatelliteClaims(satelliteId: string): Promise<ClaimResponse[]> {
    const claims = await this.prisma.claim.findMany({
      where: { satelliteId },
      include: claimInclude,
      orderBy: { submittedAt: 'desc' },
      take: MAX_CLAIMS_PER_PAGE,
    });

    return claims.map((claim) => this.toResponse(claim));
  }

  async getSatelliteClaimById(
    satelliteId: string,
    claimId: string,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, satelliteId },
      include: claimInclude,
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    return this.toResponse(claim);
  }

  async submitSatelliteReview(
    satelliteId: string,
    claimId: string,
    reviewerAccount: string | null,
    dto: SubmitSatelliteReviewDto,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findFirst({
      where: { id: claimId, satelliteId },
      include: { documents: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    const reviewableStatuses: ClaimStatus[] = [
      ClaimStatus.SUBMITTED,
      ClaimStatus.SATELLITE_REVIEW,
    ];

    if (!reviewableStatuses.includes(claim.status)) {
      throw new ConflictException(
        'This claim is not currently awaiting satellite review.',
      );
    }

    if (
      dto.decision !== SatelliteClaimDecision.FORWARD_TO_ADMIN &&
      !dto.remarks.trim()
    ) {
      throw new BadRequestException(
        dto.decision === SatelliteClaimDecision.REQUEST_CORRECTION
          ? 'Enter correction instructions for the member.'
          : 'Enter the reason for rejecting this claim.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const documentUpdate of dto.documents ?? []) {
        await transaction.claimDocument.updateMany({
          where: { claimId, id: documentUpdate.documentId },
          data: {
            status: documentUpdate.status,
            reviewedAt: new Date(),
            reviewedByAccount: reviewerAccount,
            reviewRemarks: documentUpdate.remarks?.trim() || null,
          },
        });
      }

      if (dto.decision === SatelliteClaimDecision.FORWARD_TO_ADMIN) {
        const refreshedDocuments = await transaction.claimDocument.findMany({
          where: { claimId },
          select: { type: true, required: true, status: true },
        });

        const hasUnverifiedRequiredDocument = refreshedDocuments.some(
          (document) =>
            document.required &&
            document.status !== ClaimDocumentStatus.VERIFIED,
        );

        if (hasUnverifiedRequiredDocument) {
          throw new BadRequestException(
            'All required documents must be verified before forwarding this claim to the administrator.',
          );
        }
      }

      const now = new Date();

      switch (dto.decision) {
        case SatelliteClaimDecision.FORWARD_TO_ADMIN: {
          await transaction.claim.update({
            where: { id: claimId },
            data: {
              status: ClaimStatus.FORWARDED_TO_ADMIN,
              satelliteReviewedAt: now,
              satelliteReviewedByAccount: reviewerAccount,
              satelliteRemarks: dto.remarks.trim(),
              forwardedToAdminAt: now,
              statusHistory: {
                create: {
                  status: ClaimStatus.FORWARDED_TO_ADMIN,
                  title: 'Forwarded to administrator',
                  description: dto.remarks.trim(),
                  actorType: 'satellite',
                  actorName: reviewerAccount,
                },
              },
            },
          });
          break;
        }

        case SatelliteClaimDecision.REQUEST_CORRECTION: {
          await transaction.claim.update({
            where: { id: claimId },
            data: {
              status: ClaimStatus.NEEDS_CORRECTION,
              satelliteReviewedAt: now,
              satelliteReviewedByAccount: reviewerAccount,
              satelliteRemarks: dto.remarks.trim(),
              statusHistory: {
                create: {
                  status: ClaimStatus.NEEDS_CORRECTION,
                  title: 'Correction requested',
                  description: dto.remarks.trim(),
                  actorType: 'satellite',
                  actorName: reviewerAccount,
                },
              },
            },
          });
          break;
        }

        case SatelliteClaimDecision.REJECT: {
          await transaction.claim.update({
            where: { id: claimId },
            data: {
              status: ClaimStatus.REJECTED,
              satelliteReviewedAt: now,
              satelliteReviewedByAccount: reviewerAccount,
              satelliteRemarks: dto.remarks.trim(),
              rejectionReason: dto.remarks.trim(),
              statusHistory: {
                create: {
                  status: ClaimStatus.REJECTED,
                  title: 'Rejected by satellite office',
                  description: dto.remarks.trim(),
                  actorType: 'satellite',
                  actorName: reviewerAccount,
                },
              },
            },
          });
          break;
        }
      }
    });

    return this.getSatelliteClaimById(satelliteId, claimId);
  }

  /* =========================================================
     ADMIN-FACING
  ========================================================= */

  async getAdminClaims(): Promise<ClaimResponse[]> {
    const claims = await this.prisma.claim.findMany({
      include: claimInclude,
      orderBy: { submittedAt: 'desc' },
      take: MAX_CLAIMS_PER_PAGE,
    });

    return claims.map((claim) => this.toResponse(claim));
  }

  async getAdminClaimById(claimId: string): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: claimInclude,
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    return this.toResponse(claim);
  }

  async submitAdminReview(
    claimId: string,
    adminId: string | null,
    dto: SubmitAdminReviewDto,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, status: true, requestedAmount: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    const reviewableStatuses: ClaimStatus[] = [
      ClaimStatus.FORWARDED_TO_ADMIN,
      ClaimStatus.ADMIN_REVIEW,
    ];

    if (!reviewableStatuses.includes(claim.status)) {
      throw new ConflictException(
        'This claim is not currently awaiting administrator review.',
      );
    }

    const now = new Date();

    if (dto.decision === AdminClaimDecision.APPROVE) {
      const approvedAmount =
        dto.approvedAmount ?? claim.requestedAmount.toNumber();

      await this.prisma.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.APPROVED,
          approvedAmount: new Decimal(approvedAmount),
          adminReviewedAt: now,
          adminReviewedByAdmin: adminId,
          adminRemarks: dto.remarks.trim(),
          statusHistory: {
            create: {
              status: ClaimStatus.APPROVED,
              title: 'Claim approved',
              description: dto.remarks.trim(),
              actorType: 'admin',
              actorId: adminId,
            },
          },
        },
      });
    } else {
      await this.prisma.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.REJECTED,
          rejectionReason: dto.remarks.trim(),
          adminReviewedAt: now,
          adminReviewedByAdmin: adminId,
          adminRemarks: dto.remarks.trim(),
          statusHistory: {
            create: {
              status: ClaimStatus.REJECTED,
              title: 'Rejected by administrator',
              description: dto.remarks.trim(),
              actorType: 'admin',
              actorId: adminId,
            },
          },
        },
      });
    }

    return this.getAdminClaimById(claimId);
  }

  async markClaimProcessing(
    claimId: string,
    adminId: string | null,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, status: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new ConflictException(
        'Only approved claims can be moved to payment processing.',
      );
    }

    await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.PROCESSING_PAYMENT,
        statusHistory: {
          create: {
            status: ClaimStatus.PROCESSING_PAYMENT,
            title: 'Payment processing started',
            description: 'The approved payout is being prepared for release.',
            actorType: 'admin',
            actorId: adminId,
          },
        },
      },
    });

    return this.getAdminClaimById(claimId);
  }

  async markClaimPaid(
    claimId: string,
    adminId: string | null,
    dto: MarkClaimPaidDto,
  ): Promise<ClaimResponse> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, status: true },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }

    const payableStatuses: ClaimStatus[] = [
      ClaimStatus.APPROVED,
      ClaimStatus.PROCESSING_PAYMENT,
    ];

    if (!payableStatuses.includes(claim.status)) {
      throw new ConflictException(
        'Only approved claims can be marked as paid.',
      );
    }

    await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.PAID,
        paidAt: new Date(),
        payoutReference: dto.payoutReference.trim(),
        statusHistory: {
          create: {
            status: ClaimStatus.PAID,
            title: 'Payout released',
            description: `Paid via reference ${dto.payoutReference.trim()}.`,
            actorType: 'admin',
            actorId: adminId,
          },
        },
      },
    });

    return this.getAdminClaimById(claimId);
  }

  /* =========================================================
     SHARED HELPERS
  ========================================================= */

  private assertRequiredDocumentsPresent(
    submittedTypes: ClaimDocumentType[],
  ): void {
    const submitted = new Set(submittedTypes);

    const missing = REQUIRED_CLAIM_DOCUMENTS.filter(
      (document) => document.required && !submitted.has(document.type),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `The following required documents are missing: ${missing
          .map((document) => document.type)
          .join(', ')}.`,
      );
    }
  }

  private async generateClaimNumber(
    transaction: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LC-${year}-`;

    const count = await transaction.claim.count({
      where: { claimNumber: { startsWith: prefix } },
    });

    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private toResponse(claim: ClaimWithRelations): ClaimResponse {
    return {
      id: claim.id,
      claimNumber: claim.claimNumber,
      type: claim.type.toLowerCase() as ClaimResponse['type'],
      status: claim.status.toLowerCase() as ClaimResponse['status'],

      memberId: claim.memberId,
      membershipId: claim.member.membershipId,
      memberName: buildFullName(
        claim.member.firstName,
        claim.member.middleName,
        claim.member.lastName,
      ),
      membershipType: mapMembershipType(claim.member.membershipType),

      satelliteId: claim.satelliteId,
      satelliteName: claim.satellite?.satelliteName ?? null,

      beneficiaryId: claim.beneficiaryId,
      beneficiaryName: buildFullName(
        claim.beneficiary.firstName,
        claim.beneficiary.middleName,
        claim.beneficiary.lastName,
      ),
      beneficiaryRelationship: claim.beneficiary.relationship,

      claimantName: claim.claimantName,
      claimantRelationship: claim.claimantRelationship,
      claimantContactNumber: claim.claimantContactNumber,

      dateOfDeath: claim.dateOfDeath.toISOString(),
      placeOfDeath: claim.placeOfDeath,
      causeOfDeath: claim.causeOfDeath,

      bankName: claim.bankName,
      accountName: claim.accountName,
      accountNumber: claim.accountNumber,

      remarks: claim.remarks,

      requestedAmount: claim.requestedAmount.toNumber(),
      approvedAmount: claim.approvedAmount
        ? claim.approvedAmount.toNumber()
        : null,

      satelliteReviewedAt: claim.satelliteReviewedAt
        ? claim.satelliteReviewedAt.toISOString()
        : null,
      satelliteReviewedByAccount: claim.satelliteReviewedByAccount,
      satelliteRemarks: claim.satelliteRemarks,

      forwardedToAdminAt: claim.forwardedToAdminAt
        ? claim.forwardedToAdminAt.toISOString()
        : null,

      adminReviewedAt: claim.adminReviewedAt
        ? claim.adminReviewedAt.toISOString()
        : null,
      adminReviewedByAdmin: claim.adminReviewedByAdmin,
      adminRemarks: claim.adminRemarks,
      rejectionReason: claim.rejectionReason,

      paidAt: claim.paidAt ? claim.paidAt.toISOString() : null,
      payoutReference: claim.payoutReference,

      documents: claim.documents.map((document) => ({
        id: document.id,
        type: document.type.toLowerCase() as ClaimResponse['documents'][number]['type'],
        required: document.required,
        status:
          document.status.toLowerCase() as ClaimResponse['documents'][number]['status'],
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileData: document.fileData,
        uploadedAt: document.uploadedAt.toISOString(),
        reviewedAt: document.reviewedAt
          ? document.reviewedAt.toISOString()
          : null,
        reviewedByAccount: document.reviewedByAccount,
        reviewRemarks: document.reviewRemarks,
      })),

      statusHistory: claim.statusHistory.map((entry) => ({
        id: entry.id,
        status: entry.status.toLowerCase() as ClaimResponse['status'],
        title: entry.title,
        description: entry.description,
        actorType: entry.actorType,
        actorName: entry.actorName,
        createdAt: entry.createdAt.toISOString(),
      })),

      submittedAt: claim.submittedAt.toISOString(),
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
    };
  }
}
