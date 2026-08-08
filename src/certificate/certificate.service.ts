import { Injectable, NotFoundException } from '@nestjs/common';

import { MemberStatus, MembershipType } from '../generated/prisma/client';
import { PrismaService } from '../admin/database/prisma/prisma.service';

import type {
  CertificateBeneficiaryPosition,
  CertificateBeneficiaryResponse,
  CertificateMembershipType,
  CertificateResponse,
  CertificateStatus,
} from './certificate.types';

/* =========================================================
   CONSTANTS
========================================================= */

// Matches the validity window already used for the member digital ID.
const CERTIFICATE_VALIDITY_YEARS = 2;

const AUTHORIZED_SIGNATORY = {
  name: 'Authorized Representative',
  position: 'President',
} as const;

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class CertificateService {
  constructor(private readonly prisma: PrismaService) {}

  async getCertificate(memberId: string): Promise<CertificateResponse> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        membershipId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        membershipType: true,
        status: true,
        memberSince: true,
        activatedAt: true,
        createdAt: true,

        beneficiaries: {
          select: {
            id: true,
            sequence: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member account was not found.');
    }

    const memberName = this.buildFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    );

    const validityStart =
      member.activatedAt ?? member.memberSince ?? member.createdAt;

    const expirationDate = this.calculateExpirationDate(validityStart);

    const status = this.resolveStatus(member.status, expirationDate);

    const certificateNumber = `LC-CERT-${member.membershipId}`;

    const beneficiaries: CertificateBeneficiaryResponse[] = member.beneficiaries
      .filter(
        (beneficiary) => beneficiary.sequence >= 1 && beneficiary.sequence <= 5,
      )
      .map((beneficiary) => ({
        id: beneficiary.id,
        position: beneficiary.sequence as CertificateBeneficiaryPosition,
        fullName: this.buildFullName(
          beneficiary.firstName,
          beneficiary.middleName,
          beneficiary.lastName,
        ),
      }));

    return {
      certificateNumber,
      status,
      dateIssued: this.formatDate(validityStart),
      validUntil: this.formatDate(expirationDate),

      memberName,
      membershipId: member.membershipId,
      membershipType: this.mapMembershipType(member.membershipType),
      memberSince: this.formatDate(member.memberSince ?? validityStart),

      beneficiaries,

      authorizedBy: AUTHORIZED_SIGNATORY.name,
      authorizedPosition: AUTHORIZED_SIGNATORY.position,
      authorizedSignature: null,

      verificationCode: certificateNumber,
      verificationUrl: `https://legacycare.ph/verify/certificate?certificate=${encodeURIComponent(
        certificateNumber,
      )}`,
      qrCode: null,
    };
  }

  /* =======================================================
     HELPERS
  ======================================================= */

  private buildFullName(
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

  private calculateExpirationDate(startDate: Date): Date {
    const expirationDate = new Date(startDate);

    expirationDate.setFullYear(
      expirationDate.getFullYear() + CERTIFICATE_VALIDITY_YEARS,
    );

    return expirationDate;
  }

  private resolveStatus(
    memberStatus: MemberStatus,
    expirationDate: Date,
  ): CertificateStatus {
    if (expirationDate.getTime() <= Date.now()) {
      return 'expired';
    }

    switch (memberStatus) {
      case MemberStatus.ACTIVE:
        return 'active';

      case MemberStatus.PENDING_ACTIVATION:
        return 'pending';

      case MemberStatus.SUSPENDED:
      case MemberStatus.DISABLED:
      case MemberStatus.DECEASED:
      default:
        return 'revoked';
    }
  }

  private mapMembershipType(
    membershipType: MembershipType,
  ): CertificateMembershipType {
    return membershipType === MembershipType.PREMIUM ? 'premium' : 'basic';
  }

  private formatDate(value?: Date | null): string | null {
    if (!value) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }
}
