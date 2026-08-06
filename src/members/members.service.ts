import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash, randomInt } from 'node:crypto';

import * as argon2 from 'argon2';

import {
  ActivationCodeType,
  GeneratedCodeCategory,
  GeneratedCodeStatus,
  MemberStatus,
  MembershipType,
  Prisma,
} from '../generated/prisma/client';

import { PrismaService } from '../admin/database/prisma/prisma.service';
import { createMemberOpeningCredit } from '../wallet/wallet-opening-credit';

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MEMBERSHIP_ID_PREFIX = 'LC';
const REFERRAL_CODE_PREFIX = 'LC';

const ACTIVATION_VALID_HOURS = 72;
const MAX_CODE_GENERATION_ATTEMPTS = 10;

export interface CreateMemberInput {
  firstName: string;
  middleName?: string;
  lastName: string;

  address: string;
  dateOfBirth: string;

  email?: string;
  phone: string;

  membershipType: MembershipType;

  activationCode: string;
  sponsorReferralCode: string;

  username: string;
  password: string;
  confirmPassword: string;
}

interface NormalizedCreateMemberInput {
  firstName: string;
  middleName?: string;
  lastName: string;

  address: string;
  dateOfBirth: string;

  email?: string;
  phone: string;

  membershipType: MembershipType;

  activationCode: string;
  sponsorReferralCode: string;

  username: string;
  password: string;
}

interface UniqueMemberFieldsInput {
  username: string;
  email?: string;
  phone: string;
}

function generateRandomCode(length: number): string {
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)];
  }

  return result;
}

function hashActivationCode(activationCode: string): string {
  return createHash('sha256').update(activationCode).digest('hex');
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

function normalizeEmail(email?: string): string | undefined {
  const normalized = email?.trim().toLowerCase();

  return normalized || undefined;
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s()-]/g, '');
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function startOfToday(): Date {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function createActivationExpirationDate(): Date {
  const expiresAt = new Date();

  expiresAt.setHours(expiresAt.getHours() + ACTIVATION_VALID_HOURS);

  return expiresAt;
}

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async createMember(input: CreateMemberInput) {
    this.validatePasswords(input);

    const normalized = this.normalizeCreateInput(input);

    const dateOfBirth = this.parseDateOfBirth(normalized.dateOfBirth);

    const sponsor = await this.findEligibleSponsor(
      normalized.sponsorReferralCode,
    );

    await this.ensureUniqueMemberFields({
      username: normalized.username,

      email: normalized.email,

      phone: normalized.phone,
    });

    const passwordHash = await argon2.hash(normalized.password, {
      type: argon2.argon2id,

      memoryCost: 19_456,

      timeCost: 2,

      parallelism: 1,
    });

    const activationCodeHash = hashActivationCode(normalized.activationCode);

    const activationExpiresAt = createActivationExpirationDate();

    const membershipId = await this.generateUniqueMembershipId();

    const referralCode = await this.generateUniqueReferralCode();

    try {
      const member = await this.prisma.$transaction(async (transaction) => {
        const generatedCode = await transaction.generatedCode.findUnique({
          where: {
            code: normalized.activationCode,
          },
        });

        if (!generatedCode) {
          throw new NotFoundException('The activation code was not found.');
        }

        if (generatedCode.category !== GeneratedCodeCategory.ACTIVATION) {
          throw new BadRequestException(
            'The submitted code is not an activation code.',
          );
        }

        const expectedActivationType =
          normalized.membershipType === MembershipType.PREMIUM
            ? ActivationCodeType.PREMIUM
            : ActivationCodeType.BASIC;

        if (generatedCode.activationType !== expectedActivationType) {
          throw new BadRequestException(
            `This activation code is for ${generatedCode.activationType?.toLowerCase() ?? 'another'} membership.`,
          );
        }

        if (
          generatedCode.expiresAt &&
          generatedCode.expiresAt.getTime() <= Date.now()
        ) {
          throw new ConflictException('The activation code has expired.');
        }

        if (
          generatedCode.status !== GeneratedCodeStatus.AVAILABLE &&
          generatedCode.status !== GeneratedCodeStatus.ASSIGNED
        ) {
          throw new ConflictException(
            'The activation code has already been used or is no longer available.',
          );
        }

        const createdMember = await transaction.member.create({
          data: {
            membershipId,

            firstName: normalized.firstName,

            middleName: normalized.middleName,

            lastName: normalized.lastName,

            address: normalized.address,

            dateOfBirth,

            email: normalized.email,

            phone: normalized.phone,

            username: normalized.username,

            passwordHash,

            membershipType: normalized.membershipType,

            activationCodeHash,

            activationExpiresAt,

            referralCode,

            sponsorId: sponsor.id,

            memberSince: startOfToday(),

            activatedAt: new Date(),

            status: MemberStatus.ACTIVE,
          },

          select: {
            id: true,
            membershipId: true,

            firstName: true,
            middleName: true,
            lastName: true,

            address: true,
            dateOfBirth: true,

            email: true,
            phone: true,
            username: true,

            membershipType: true,
            referralCode: true,

            sponsorId: true,

            activationExpiresAt: true,

            memberSince: true,
            activatedAt: true,

            status: true,

            createdAt: true,
            updatedAt: true,
          },
        });

        await createMemberOpeningCredit(transaction, createdMember.id);

        const usedAt = new Date();
        const consumption = await transaction.generatedCode.updateMany({
          where: {
            id: generatedCode.id,
            status: {
              in: [GeneratedCodeStatus.AVAILABLE, GeneratedCodeStatus.ASSIGNED],
            },
            usedByMemberId: null,
          },
          data: {
            status: GeneratedCodeStatus.USED,
            usedAt,
            usedByMemberId: createdMember.id,
            usedByMemberName: [
              createdMember.firstName,
              createdMember.middleName,
              createdMember.lastName,
            ]
              .filter(Boolean)
              .join(' '),
          },
        });

        if (consumption.count !== 1) {
          throw new ConflictException(
            'The activation code was used by another registration. Please request another code.',
          );
        }

        return createdMember;
      });

      return {
        id: member.id,

        membershipId: member.membershipId,

        firstName: member.firstName,

        middleName: member.middleName,

        lastName: member.lastName,

        fullName: [member.firstName, member.middleName, member.lastName]
          .filter(Boolean)
          .join(' '),

        address: member.address,

        dateOfBirth: member.dateOfBirth?.toISOString() ?? null,

        email: member.email,

        phone: member.phone,

        username: member.username,

        membershipType: member.membershipType,

        referralCode: member.referralCode,

        sponsorId: member.sponsorId,

        sponsorMembershipId: sponsor.membershipId,

        sponsorReferralCode: sponsor.referralCode,

        activationExpiresAt: member.activationExpiresAt?.toISOString() ?? null,

        memberSince: member.memberSince?.toISOString() ?? null,

        activatedAt: member.activatedAt?.toISOString() ?? null,

        status: member.status,

        createdAt: member.createdAt.toISOString(),

        updatedAt: member.updatedAt.toISOString(),
      };
    } catch (error) {
      this.handlePrismaCreateError(error);

      throw error;
    }
  }

  private validatePasswords(input: CreateMemberInput): void {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException(
        'Password and confirm password do not match.',
      );
    }

    if (input.password.length < 6) {
      throw new BadRequestException(
        'Password must contain at least 6 characters.',
      );
    }
  }

  private normalizeCreateInput(
    input: CreateMemberInput,
  ): NormalizedCreateMemberInput {
    const firstName = normalizeRequiredText(input.firstName, 'First name');

    const lastName = normalizeRequiredText(input.lastName, 'Last name');

    const address = normalizeRequiredText(input.address, 'Address');

    const dateOfBirth = normalizeRequiredText(
      input.dateOfBirth,
      'Date of birth',
    );

    const phone = normalizePhone(
      normalizeRequiredText(input.phone, 'CP number'),
    );

    const username = normalizeUsername(
      normalizeRequiredText(input.username, 'Username'),
    );

    const activationCode = normalizeCode(
      normalizeRequiredText(input.activationCode, 'Activation code'),
    );

    const sponsorReferralCode = normalizeCode(
      normalizeRequiredText(input.sponsorReferralCode, 'Sponsor referral code'),
    );

    return {
      firstName,

      middleName: normalizeOptionalText(input.middleName),

      lastName,

      address,

      dateOfBirth,

      email: normalizeEmail(input.email),

      phone,

      membershipType: input.membershipType,

      activationCode,

      sponsorReferralCode,

      username,

      password: input.password,
    };
  }

  private parseDateOfBirth(value: string): Date {
    const dateOfBirth = new Date(value);

    if (Number.isNaN(dateOfBirth.getTime())) {
      throw new BadRequestException('Date of birth is invalid.');
    }

    if (dateOfBirth > new Date()) {
      throw new BadRequestException('Date of birth cannot be in the future.');
    }

    return dateOfBirth;
  }

  private async findEligibleSponsor(sponsorReferralCode: string) {
    const sponsor = await this.prisma.member.findUnique({
      where: {
        referralCode: sponsorReferralCode,
      },

      select: {
        id: true,
        membershipId: true,
        referralCode: true,
        status: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException(
        'The referral code does not belong to an existing member.',
      );
    }

    if (
      sponsor.status === MemberStatus.SUSPENDED ||
      sponsor.status === MemberStatus.DISABLED
    ) {
      throw new BadRequestException(
        'The sponsor account is not eligible to refer new members.',
      );
    }

    return sponsor;
  }

  private async ensureUniqueMemberFields(
    input: UniqueMemberFieldsInput,
  ): Promise<void> {
    const duplicateConditions: Prisma.MemberWhereInput[] = [
      {
        username: input.username,
      },

      {
        phone: input.phone,
      },
    ];

    if (input.email) {
      duplicateConditions.push({
        email: input.email,
      });
    }

    const existingMember = await this.prisma.member.findFirst({
      where: {
        OR: duplicateConditions,
      },

      select: {
        username: true,
        email: true,
        phone: true,
      },
    });

    if (!existingMember) {
      return;
    }

    if (existingMember.username === input.username) {
      throw new ConflictException('The username is already in use.');
    }

    if (input.email && existingMember.email === input.email) {
      throw new ConflictException('The email address is already in use.');
    }

    if (existingMember.phone === input.phone) {
      throw new ConflictException('The CP number is already in use.');
    }

    throw new ConflictException(
      'A member with the supplied information already exists.',
    );
  }

  private async generateUniqueMembershipId(): Promise<string> {
    for (
      let attempt = 0;
      attempt < MAX_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const dateSegment = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

      const randomSegment = generateRandomCode(6);

      const membershipId = `${MEMBERSHIP_ID_PREFIX}-${dateSegment}-${randomSegment}`;

      const existing = await this.prisma.member.findUnique({
        where: {
          membershipId,
        },

        select: {
          id: true,
        },
      });

      if (!existing) {
        return membershipId;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique membership ID. Please try again.',
    );
  }

  private async generateUniqueReferralCode(): Promise<string> {
    for (
      let attempt = 0;
      attempt < MAX_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const referralCode = `${REFERRAL_CODE_PREFIX}-${generateRandomCode(8)}`;

      const existing = await this.prisma.member.findUnique({
        where: {
          referralCode,
        },

        select: {
          id: true,
        },
      });

      if (!existing) {
        return referralCode;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique referral code. Please try again.',
    );
  }

  private handlePrismaCreateError(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(',')
      : String(error.meta?.target ?? '');

    if (target.includes('username')) {
      throw new ConflictException('The username is already in use.');
    }

    if (target.includes('email')) {
      throw new ConflictException('The email address is already in use.');
    }

    if (target.includes('phone')) {
      throw new ConflictException('The CP number is already in use.');
    }

    if (
      target.includes('activationCodeHash') ||
      target.includes('activation_code_hash')
    ) {
      throw new ConflictException(
        'The activation code has already been assigned to another member.',
      );
    }

    if (target.includes('membershipId') || target.includes('membership_id')) {
      throw new ConflictException(
        'The generated membership ID already exists. Please try again.',
      );
    }

    if (target.includes('referralCode') || target.includes('referral_code')) {
      throw new ConflictException(
        'The generated referral code already exists. Please try again.',
      );
    }

    throw new ConflictException(
      'A member with the supplied information already exists.',
    );
  }
}
