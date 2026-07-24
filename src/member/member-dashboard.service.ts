import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  MemberStatus,
  MembershipType,
} from "../generated/prisma/client";

import { PrismaService } from "../admin/database/prisma/prisma.service";

import type {
  GenealogyMemberDto,
  GenealogyResponseDto,
} from "./member-dashboard.types";

export interface MemberDashboardTotals {
  memberCount: number;
  beneficiaryCount: number;
  totalMembers: number;
}

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

const DIRECT_LEFT_LIMIT = 3;

const genealogyMemberSelect = {
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
} as const;

function mapMemberStatus(
  status: MemberStatus,
): GenealogyMemberDto["status"] {
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
): GenealogyMemberDto["membershipType"] {
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
): GenealogyMemberDto {
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
    membershipId: member.membershipId,

    firstName: member.firstName,
    middleName: member.middleName,
    lastName: member.lastName,
    fullName,

    username: member.username,

    membershipType: mapMembershipType(
      member.membershipType,
    ),

    status: mapMemberStatus(
      member.status,
    ),

    referralCode: member.referralCode,
    sponsorId: member.sponsorId,

    createdAt: member.createdAt.toISOString(),
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
  ): Promise<GenealogyResponseDto> {
    const rootMember =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select: genealogyMemberSelect,
      });

    if (!rootMember) {
      throw new NotFoundException(
        "Member account was not found.",
      );
    }

    const directReferrals =
      await this.prisma.member.findMany({
        where: {
          sponsorId: rootMember.id,
        },

        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],

        select: genealogyMemberSelect,
      });

    const mappedRoot =
      mapGenealogyMember(
        rootMember,
      );

    const mappedDirectReferrals =
      directReferrals.map(
        mapGenealogyMember,
      );

    const leftMembers =
      mappedDirectReferrals.slice(
        0,
        DIRECT_LEFT_LIMIT,
      );

    const rightMembers =
      mappedDirectReferrals.slice(
        DIRECT_LEFT_LIMIT,
      );

    const visibleMembers = [
      mappedRoot,
      ...mappedDirectReferrals,
    ];

    const activeMembers =
      visibleMembers.filter(
        (member) =>
          member.status === "active",
      ).length;

    const pendingMembers =
      visibleMembers.filter(
        (member) =>
          member.status === "pending",
      ).length;

    const suspendedMembers =
      visibleMembers.filter(
        (member) =>
          member.status === "suspended",
      ).length;

    const inactiveMembers =
      visibleMembers.filter(
        (member) =>
          member.status === "inactive",
      ).length;

    const nextPlacement:
      GenealogyResponseDto["placementRules"]["nextPlacement"] =
        mappedDirectReferrals.length <
        DIRECT_LEFT_LIMIT
          ? "LEFT"
          : "RIGHT";

    return {
      success: true,

      root: mappedRoot,

      branches: {
        left: leftMembers,
        right: rightMembers,
      },

      statistics: {
        totalMembers:
          visibleMembers.length,

        activeMembers,
        pendingMembers,
        suspendedMembers,
        inactiveMembers,
      },

      placementRules: {
        leftLimit:
          DIRECT_LEFT_LIMIT,

        leftCount:
          leftMembers.length,

        rightCount:
          rightMembers.length,

        remainingLeftSlots:
          Math.max(
            DIRECT_LEFT_LIMIT -
              leftMembers.length,
            0,
          ),

        nextPlacement,
      },

      sponsorReferralCode:
        rootMember.referralCode,
    };
  }
}