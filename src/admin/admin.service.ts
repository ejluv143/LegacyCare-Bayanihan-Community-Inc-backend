import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash, randomInt } from 'node:crypto';

import * as argon2 from 'argon2';

import {
  MemberStatus,
  MembershipType,
  Prisma,
} from '../generated/prisma/client';

import { createMemberOpeningCredit } from '../wallet/wallet-opening-credit';
import { CreateMemberDto } from './database/create-member.dto';
import { PrismaService } from './database/prisma/prisma.service';

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ACTIVATION_VALID_HOURS = 72;

const PASSWORD_MEMORY_COST = 19_456;
const PASSWORD_TIME_COST = 2;
const PASSWORD_PARALLELISM = 1;

type FrontendMemberStatus = 'pending' | 'active' | 'suspended' | 'inactive';

type FrontendMembershipType = 'basic';

interface MemberNameFields {
  firstName: string;
  middleName: string | null;
  lastName: string;
}

interface SponsorEligibilityFields {
  status: MemberStatus;
  rootMarker: string | null;
}

function generateRandomCode(length: number): string {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)];
  }

  return code;
}

function hashActivationCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: PASSWORD_MEMORY_COST,
    timeCost: PASSWORD_TIME_COST,
    parallelism: PASSWORD_PARALLELISM,
  });
}

function buildFullName(member: MemberNameFields): string {
  return [member.firstName, member.middleName, member.lastName]
    .filter(Boolean)
    .join(' ');
}

function mapMemberStatus(status: MemberStatus): FrontendMemberStatus {
  switch (status) {
    case MemberStatus.ACTIVE:
      return 'active';

    case MemberStatus.SUSPENDED:
      return 'suspended';

    case MemberStatus.DISABLED:
      return 'inactive';

    case MemberStatus.PENDING_ACTIVATION:
    default:
      return 'pending';
  }
}

function mapMembershipType(
  _membershipType: MembershipType,
): FrontendMembershipType {
  return 'basic';
}

function canMemberSponsor(member: SponsorEligibilityFields): boolean {
  /*
   * Active members can sponsor normally.
   */
  if (member.status === MemberStatus.ACTIVE) {
    return true;
  }

  /*
   * The root member may sponsor while pending
   * activation. This allows the network to begin
   * even when the original root account has not
   * completed activation.
   */
  return (
    member.status === MemberStatus.PENDING_ACTIVATION &&
    member.rootMarker === 'ROOT'
  );
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns every registered member.
   */
  async getMembers() {
    const members = await this.prisma.member.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        membershipId: true,

        firstName: true,
        middleName: true,
        lastName: true,

        username: true,
        email: true,
        phone: true,

        membershipType: true,
        status: true,

        referralCode: true,
        sponsorId: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    const sponsorIds = [
      ...new Set(
        members
          .map((member) => member.sponsorId)
          .filter((sponsorId): sponsorId is string => sponsorId !== null),
      ),
    ];

    const sponsors =
      sponsorIds.length > 0
        ? await this.prisma.member.findMany({
            where: {
              id: {
                in: sponsorIds,
              },
            },

            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          })
        : [];

    const sponsorNames = new Map(
      sponsors.map((sponsor) => [sponsor.id, buildFullName(sponsor)]),
    );

    return {
      success: true,

      message: 'Members retrieved successfully',

      members: members.map((member) => ({
        id: member.id,

        membershipId: member.membershipId,

        firstName: member.firstName,

        middleName: member.middleName,

        lastName: member.lastName,

        fullName: buildFullName(member),

        username: member.username,

        email: member.email,

        phone: member.phone,

        membershipType: mapMembershipType(member.membershipType),

        status: mapMemberStatus(member.status),

        referralCode: member.referralCode,

        referredById: member.sponsorId,

        referredBy: member.sponsorId
          ? (sponsorNames.get(member.sponsorId) ?? null)
          : null,

        memberSince: member.createdAt.toISOString(),

        activatedAt: null,

        createdAt: member.createdAt.toISOString(),

        updatedAt: member.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Creates a new member.
   *
   * Sponsor rules:
   *
   * - First member: no sponsor allowed; becomes ROOT.
   * - Later member without code: allowed without sponsor.
   * - Later member with valid code: linked to sponsor.
   * - Later member with invalid code: rejected.
   */
  async createMember(dto: CreateMemberDto) {
    const passwordHash = await hashPassword(dto.password);

    const membershipId = `LC-${generateRandomCode(12)}`;

    const referralCode = `LC-REF-${generateRandomCode(8)}`;

    const activationCode = `LC-ACT-${generateRandomCode(12)}`;

    const activationExpiresAt = new Date(
      Date.now() + ACTIVATION_VALID_HOURS * 60 * 60 * 1000,
    );

    try {
      const member = await this.prisma.$transaction(
        async (transaction) => {
          const existingMember = await transaction.member.findFirst({
            select: {
              id: true,
            },
          });

          let sponsorId: string | null = null;

          let rootMarker: string | null = null;

          const sponsorReferralCode = dto.sponsorReferralCode
            ?.trim()
            .toUpperCase();

          /*
           * The first member is the root member.
           */
          if (!existingMember) {
            if (sponsorReferralCode) {
              throw new BadRequestException(
                'The first member cannot have a sponsor referral code',
              );
            }

            rootMarker = 'ROOT';
          }

          /*
           * Later members may optionally provide
           * a sponsor referral code.
           *
           * When it is blank, sponsorId remains
           * null and member creation continues.
           */
          if (existingMember && sponsorReferralCode) {
            const sponsor = await transaction.member.findUnique({
              where: {
                referralCode: sponsorReferralCode,
              },

              select: {
                id: true,
                status: true,
                rootMarker: true,
              },
            });

            if (!sponsor) {
              throw new BadRequestException('Sponsor referral code is invalid');
            }

            if (!canMemberSponsor(sponsor)) {
              throw new BadRequestException(
                'The selected sponsor is not eligible to sponsor a new member',
              );
            }

            sponsorId = sponsor.id;
          }

          const createdMember = await transaction.member.create({
            data: {
              membershipId,

              firstName: dto.firstName.trim(),

              middleName: dto.middleName?.trim() || null,

              lastName: dto.lastName.trim(),

              email: dto.email?.trim().toLowerCase() || null,

              phone: dto.phone.trim(),

              username: dto.username.trim().toLowerCase(),

              /*
               * Only the Argon2id password hash
               * is stored.
               */
              passwordHash,

              membershipType: MembershipType.BASIC,

              status: MemberStatus.PENDING_ACTIVATION,

              referralCode,

              activationCodeHash: hashActivationCode(activationCode),

              activationExpiresAt,

              sponsorId,

              rootMarker,
            },

            select: {
              id: true,
              membershipId: true,

              firstName: true,
              middleName: true,
              lastName: true,

              email: true,
              phone: true,
              username: true,

              membershipType: true,
              status: true,

              referralCode: true,
              sponsorId: true,

              activationExpiresAt: true,

              createdAt: true,
              updatedAt: true,
            },
          });

          await createMemberOpeningCredit(transaction, createdMember.id);

          return createdMember;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      const fullName = buildFullName(member);

      return {
        success: true,

        message: 'Member created successfully',

        member: {
          id: member.id,

          membershipId: member.membershipId,

          firstName: member.firstName,

          middleName: member.middleName,

          lastName: member.lastName,

          fullName,

          username: member.username,

          email: member.email,

          phone: member.phone,

          membershipType: mapMembershipType(member.membershipType),

          status: mapMemberStatus(member.status),

          referralCode: member.referralCode,

          referredById: member.sponsorId,

          referredBy: null,

          memberSince: member.createdAt.toISOString(),

          activatedAt: null,

          createdAt: member.createdAt.toISOString(),

          updatedAt: member.updatedAt.toISOString(),
        },

        credentials: {
          membershipId: member.membershipId,

          username: member.username,

          activationCode,

          referralCode: member.referralCode,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'The username, email, membership ID, or generated code already exists',
          );
        }

        if (error.code === 'P2034') {
          throw new ConflictException(
            'Another member was created at the same time. Please try again',
          );
        }
      }

      throw error;
    }
  }

  /**
   * Generates a replacement activation code for
   * a member who is still pending activation.
   */
  async regenerateMemberCredentials(memberId: string) {
    const existingMember = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },

      select: {
        id: true,
        membershipId: true,
        username: true,
        referralCode: true,
        status: true,
      },
    });

    if (!existingMember) {
      throw new NotFoundException('Member not found');
    }

    if (existingMember.status !== MemberStatus.PENDING_ACTIVATION) {
      throw new BadRequestException(
        'A new activation code can only be generated for a member pending activation',
      );
    }

    const activationCode = `LC-ACT-${generateRandomCode(12)}`;

    const activationExpiresAt = new Date(
      Date.now() + ACTIVATION_VALID_HOURS * 60 * 60 * 1000,
    );

    const member = await this.prisma.member.update({
      where: {
        id: memberId,
      },

      data: {
        activationCodeHash: hashActivationCode(activationCode),

        activationExpiresAt,
      },

      select: {
        membershipId: true,
        username: true,
        referralCode: true,
      },
    });

    return {
      success: true,

      message: 'A new activation code was generated successfully',

      credentials: {
        membershipId: member.membershipId,

        username: member.username,

        activationCode,

        referralCode: member.referralCode,
      },
    };
  }
}
