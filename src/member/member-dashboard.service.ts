import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  MemberStatus,
  MembershipType,
} from "../generated/prisma/client";

import { PrismaService } from "../admin/database/prisma/prisma.service";

export interface MemberDashboardTotals {
  memberCount: number;
  beneficiaryCount: number;
  totalMembers: number;
}

type FrontendMemberStatus =
  | "pending"
  | "active"
  | "suspended"
  | "inactive";

type FrontendMembershipType =
  | "basic"
  | "premium";

interface GenealogyMemberRecord {
  id: string;
  membershipId: string;

  firstName: string;
  middleName: string | null;
  lastName: string;

  username: string;

  membershipType: MembershipType;
  status: MemberStatus;

  referralCode: string;

  sponsorId: string | null;

  createdAt: Date;
}

function mapMemberStatus(
  status: MemberStatus,
): FrontendMemberStatus {
  switch (status) {
    case MemberStatus.ACTIVE:
      return "active";

    case MemberStatus.SUSPENDED:
      return "suspended";

    case MemberStatus.DISABLED:
      return "inactive";

    case MemberStatus.PENDING_ACTIVATION:
    default:
      return "pending";
  }
}

function mapMembershipType(
  membershipType: MembershipType,
): FrontendMembershipType {
  switch (membershipType) {
    case MembershipType.PREMIUM:
      return "premium";

    case MembershipType.BASIC:
    default:
      return "basic";
  }
}

function mapGenealogyMember(
  member: GenealogyMemberRecord,
) {
  const fullName = [
    member.firstName,
    member.middleName,
    member.lastName,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0,
    )
    .join(" ");

  return {
    id: member.id,

    membershipId:
      member.membershipId,

    firstName:
      member.firstName,

    middleName:
      member.middleName,

    lastName:
      member.lastName,

    fullName,

    username:
      member.username,

    membershipType:
      mapMembershipType(
        member.membershipType,
      ),

    status:
      mapMemberStatus(
        member.status,
      ),

    referralCode:
      member.referralCode,

    sponsorId:
      member.sponsorId,

    createdAt:
      member.createdAt.toISOString(),
  };
}

@Injectable()
export class MemberDashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getMemberTotals(): Promise<MemberDashboardTotals> {
    const [
      memberCount,
      beneficiaryCount,
    ] = await this.prisma.$transaction([
      this.prisma.member.count(),
      this.prisma.beneficiary.count(),
    ]);

    return {
      memberCount,
      beneficiaryCount,

      totalMembers:
        memberCount +
        beneficiaryCount,
    };
  }

  async getGenealogy(
    memberId: string,
  ) {
    const rootMember =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select: {
          id: true,
          membershipId: true,

          firstName: true,
          middleName: true,
          lastName: true,

          username: true,

          membershipType: true,
          status: true,

          referralCode: true,

          sponsorId: true,

          createdAt: true,
        },
      });

    if (!rootMember) {
      throw new NotFoundException(
        "Member account was not found.",
      );
    }

    const directReferrals =
      await this.prisma.member.findMany({
        where: {
          sponsorId:
            rootMember.id,
        },

        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          membershipId: true,

          firstName: true,
          middleName: true,
          lastName: true,

          username: true,

          membershipType: true,
          status: true,

          referralCode: true,

          sponsorId: true,

          createdAt: true,
        },
      });

    const mappedRoot =
      mapGenealogyMember(
        rootMember,
      );

    const mappedDirectReferrals =
      directReferrals.map(
        (member) =>
          mapGenealogyMember(member),
      );

    return {
      success: true,

      root:
        mappedRoot,

      directReferrals:
        mappedDirectReferrals,

      directReferralCount:
        mappedDirectReferrals.length,

      sponsorReferralCode:
        rootMember.referralCode,

      nextPlacement:
        mappedDirectReferrals.length < 3
          ? "LEFT"
          : "RIGHT",
    };
  }
}