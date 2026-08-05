import { Injectable, NotFoundException } from '@nestjs/common';

import { MembershipType } from '../generated/prisma/client';
import { PrismaService } from '../admin/database/prisma/prisma.service';

import { mapMemberStatus, mapMembershipType } from './digital-id.types';

import type {
  DigitalIdBeneficiaryPosition,
  DigitalIdBenefitResponse,
  DigitalIdResponse,
} from './digital-id.types';

/* =========================================================
   CONSTANTS
========================================================= */

const DIGITAL_ID_VALIDITY_YEARS = 2;

const ORGANIZATION = {
  name: 'Legacy Care Bayanihan Community Inc.',

  serviceName: 'Social Welfare Services',

  tagline: 'Stronger Together. Protected Forever.',

  logo: '/logos/legacylogo.png',

  shield: 'https://api.iconify.design/mdi/shield-account.svg?color=%23064329',

  address: 'Purok 5, Barangay Poblacion, Valencia City, Bukidnon, 8709',

  website: 'www.legacycare.ph',

  email: 'support@legacycare.ph',
} as const;

const DEFAULT_MEMBER_PHOTO =
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85';

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class DigitalIdService {
  constructor(private readonly prisma: PrismaService) {}

  /* =======================================================
     GET DIGITAL ID
  ======================================================= */

  async getDigitalId(memberId: string): Promise<DigitalIdResponse> {
    /* =====================================================
       MEMBER + BENEFICIARIES
    ===================================================== */

    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },

      select: {
        id: true,

        membershipId: true,

        firstName: true,

        middleName: true,

        lastName: true,

        email: true,

        phone: true,

        profilePhoto: true,

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

            relationship: true,

            address: true,
          },

          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });

    /* =====================================================
       MEMBER NOT FOUND
    ===================================================== */

    if (!member) {
      throw new NotFoundException('Member account not found.');
    }

    /* =====================================================
       MEMBER NAME
    ===================================================== */

    const fullName = this.buildFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    );

    /* =====================================================
       MEMBERSHIP
    ===================================================== */

    const membershipLevel = mapMembershipType(member.membershipType);

    const membershipStatus = mapMemberStatus(member.status);

    /* =====================================================
       VALIDITY
    ===================================================== */

    const validityStart =
      member.activatedAt ?? member.memberSince ?? member.createdAt;

    const expirationDate = this.calculateExpirationDate(validityStart);

    const activationDateString = this.formatDate(validityStart);

    const expirationDateString = this.formatDate(expirationDate);

    /* =====================================================
       DIGITAL ID MEMBER
    ===================================================== */

    const digitalIdMember = {
      id: member.id,

      firstName: member.firstName,

      middleName: member.middleName,

      lastName: member.lastName,

      fullName,

      mobileNumber: member.phone,

      email: member.email,

      profilePhoto: member.profilePhoto,

      /*
       * QR image generation can be added
       * later.
       */
      qrCode: null,

      membership: {
        membershipId: member.membershipId,

        level: membershipLevel,

        status: membershipStatus,

        activationDate: activationDateString,

        expirationDate: expirationDateString,
      },
    };

    /* =====================================================
       BENEFICIARIES
    ===================================================== */

    const beneficiaries = member.beneficiaries
      .filter(
        (beneficiary) => beneficiary.sequence >= 1 && beneficiary.sequence <= 5,
      )
      .map((beneficiary) => ({
        id: beneficiary.id,

        position: beneficiary.sequence as DigitalIdBeneficiaryPosition,

        firstName: beneficiary.firstName,

        middleName: beneficiary.middleName,

        lastName: beneficiary.lastName,

        fullName: this.buildFullName(
          beneficiary.firstName,
          beneficiary.middleName,
          beneficiary.lastName,
        ),

        relationship: beneficiary.relationship,

        address: beneficiary.address,
      }));

    /* =====================================================
       MEMBERSHIP BENEFITS
    ===================================================== */

    let benefits: DigitalIdBenefitResponse[] = [
      {
        id: 'accidental-death-24-hours',

        title: 'Accidental Death Assistance',

        subtitle: 'After 24 Hours',

        amount: '₱25,000 Cash',

        grocery: '₱5,000 Grocery',
      },

      {
        id: 'accidental-death-six-months',

        title: 'Accidental Death Assistance',

        subtitle: '6 Months Contestability',

        amount: '₱50,000 Cash',

        grocery: '₱10,000 Grocery',
      },

      {
        id: 'natural-death-four-months',

        title: 'Natural Death Assistance',

        subtitle: '4 Months Contestability',

        amount: '₱25,000 Cash',

        grocery: '₱5,000 Grocery',
      },

      {
        id: 'natural-death-eight-months',

        title: 'Natural Death Assistance',

        subtitle: '8 Months Contestability',

        amount: '₱50,000 Cash',

        grocery: '₱10,000 Grocery',
      },

      {
        id: 'hospitalization',

        title: 'Hospitalization Assistance',

        subtitle: 'Qualified hospital confinement',

        amount: '₱3,000 per day for 7 days',

        grocery: 'Laboratory and medicine assistance',
      },
    ];

    benefits = [
      {
        id: 'accidental-death-24-hours',
        title: 'Accidental Death Assistance',
        subtitle: 'After 24 Hours',
        amount: '₱30,000',
      },
      {
        id: 'accidental-death-10-months',
        title: 'Accidental Death Assistance',
        subtitle: 'After 10 Months',
        amount: '₱60,000',
      },
      {
        id: 'natural-death-6-months',
        title: 'Natural Death Assistance',
        subtitle: 'After 6 Months of Membership',
        amount: '₱30,000',
      },
      {
        id: 'natural-death-10-months',
        title: 'Natural Death Assistance',
        subtitle: 'After 10 Months of Membership',
        amount: '₱60,000',
      },
      member.membershipType === MembershipType.PREMIUM
        ? {
            id: 'premium-hospitalization',
            title: 'Hospitalization Assistance',
            subtitle: 'After 6 Months of Membership',
            amount: '₱75,000 total • ₱4,000/day for 15 days',
            grocery: 'Medicine ₱7,500 • Laboratory ₱7,500',
          }
        : {
            id: 'basic-hospitalization',
            title: 'Hospitalization Assistance',
            subtitle: 'After 6 Months of Membership',
            amount: '₱60,000 total • ₱3,000/day for 7 days',
            grocery: 'Medicine ₱4,500 • Laboratory ₱4,500',
          },
    ];

    /* =====================================================
       REMINDERS
    ===================================================== */

    const reminders = [
      {
        id: 'non-transferable',

        text: 'This membership ID is non-transferable.',
      },

      {
        id: 'present-id',

        text: 'Present this ID when availing of Legacy Care benefits and assistance.',
      },

      {
        id: 'report-loss',

        text: 'Report any loss, theft, damage, or unauthorized use of this card immediately.',
      },

      {
        id: 'terms',

        text: 'Benefits are subject to Legacy Care terms, eligibility requirements, verification, and approved claim procedures.',
      },
    ];

    /* =====================================================
       VERIFICATION
    ===================================================== */

    const verificationUrl = `https://legacycare.ph/verify?membershipId=${encodeURIComponent(
      member.membershipId,
    )}`;

    /* =====================================================
       RESPONSE
    ===================================================== */

    const response: DigitalIdResponse = {
      digitalId: {
        member: digitalIdMember,
      },

      branding: {
        organizationName: ORGANIZATION.name,

        serviceName: ORGANIZATION.serviceName,

        tagline: ORGANIZATION.tagline,

        logo: ORGANIZATION.logo,

        shield: ORGANIZATION.shield,
      },

      benefits,

      beneficiaries,

      reminders,

      contact: {
        officeAddress: ORGANIZATION.address,

        /*
         * For the current card design,
         * contact person is the member.
         */
        contactPerson: fullName,

        contactNumber: member.phone,

        website: ORGANIZATION.website,

        email: ORGANIZATION.email,
      },

      validity: {
        activationDate: activationDateString,

        expirationDate: expirationDateString,

        membershipId: member.membershipId,

        membershipLevel,

        membershipStatus,
      },

      verification: {
        qrCode: null,

        verificationCode: member.membershipId,

        verificationUrl,
      },

      fallbackMemberPhoto: DEFAULT_MEMBER_PHOTO,
    };

    return response;
  }

  /* =======================================================
     BUILD FULL NAME
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

  /* =======================================================
     CALCULATE EXPIRATION DATE
  ======================================================= */

  private calculateExpirationDate(startDate: Date): Date {
    const expirationDate = new Date(startDate);

    expirationDate.setFullYear(
      expirationDate.getFullYear() + DIGITAL_ID_VALIDITY_YEARS,
    );

    return expirationDate;
  }

  /* =======================================================
     FORMAT DATE
  ======================================================= */

  private formatDate(value?: Date | null): string | null {
    if (!value) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }
}
