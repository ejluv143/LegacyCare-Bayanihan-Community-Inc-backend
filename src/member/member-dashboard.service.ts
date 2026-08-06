import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  MemberStatus,
  MembershipType,
} from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";

import { PrismaService } from "../admin/database/prisma/prisma.service";
import { MembersService } from "../members/members.service";

import type { CreateGenealogyMemberDto } from "./dto/create-genealogy-member.dto";

import type {
  GenealogyMemberDto,
  GenealogyResponseDto,
  TopPerformerDto,
  TopPerformersPeriod,
  TopPerformersResponseDto,
} from "./member-dashboard.types";

export interface MemberDashboardStats {
  walletBalance: number;
  walletGrowthPercent: number;

  totalEarnings: number;
  earningsGrowthPercent: number;

  referralCommission: number;
  referralCommissionGrowthPercent: number;

  groupCommission: number;
  groupCommissionGrowthPercent: number;

  monthlyIncoming: number;
  monthlyWithdrawals: number;
}

export interface MemberDashboardStatsResponse {
  success: true;
  stats: MemberDashboardStats;
}

export interface MemberDashboardTotals {
  memberCount: number;
  beneficiaryCount: number;
  totalMembers: number;
}

export interface RecentVerifiedMemberDto {
  id: string;
  membershipId: string;
  fullName: string;
  membershipType: "basic" | "premium";
  avatarUrl: string | null;
  verifiedAt: string | null;
}

export interface RecentVerifiedMembersResponse {
  success: true;
  members: RecentVerifiedMemberDto[];
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

  /*
   * Prisma schema field that identifies
   * the member's sponsor.
   */
  sponsorId: string | null;

  createdAt: Date;
}

interface RecentVerifiedMemberRecord {
  id: string;
  membershipId: string;

  firstName: string;
  middleName: string | null;
  lastName: string;

  membershipType: MembershipType;

  activatedAt: Date | null;
}

const DIRECT_LEFT_LIMIT = 3;
const RECENT_VERIFIED_MEMBERS_LIMIT = 5;
const TOP_PERFORMERS_LIMIT = 10;
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const TOP_PERFORMERS_PERIODS: TopPerformersPeriod[] = [
  "month",
  "year",
  "all-time",
];

interface TopPerformersPeriodRange {
  start: Date;
  end: Date;
}

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

const recentVerifiedMemberSelect = {
  id: true,
  membershipId: true,

  firstName: true,
  middleName: true,
  lastName: true,

  membershipType: true,

  activatedAt: true,
} as const;

function createFullName(
  firstName: string,
  middleName: string | null,
  lastName: string,
): string {
  return [
    firstName,
    middleName,
    lastName,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(" ");
}

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

function mapRecentMembershipType(
  membershipType: MembershipType,
): RecentVerifiedMemberDto["membershipType"] {
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
  return {
    id: member.id,
    membershipId: member.membershipId,

    firstName: member.firstName,
    middleName: member.middleName,
    lastName: member.lastName,

    fullName: createFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    ),

    username: member.username,

    membershipType: mapMembershipType(
      member.membershipType,
    ),

    status: mapMemberStatus(
      member.status,
    ),

    referralCode: member.referralCode,

    sponsorId: member.sponsorId,

    createdAt:
      member.createdAt.toISOString(),
  };
}

function mapRecentVerifiedMember(
  member: RecentVerifiedMemberRecord,
): RecentVerifiedMemberDto {
  return {
    id: member.id,
    membershipId: member.membershipId,

    fullName: createFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    ),

    membershipType: mapRecentMembershipType(
      member.membershipType,
    ),

    /*
     * The current Prisma schema does not expose
     * a profile-image field in this selection.
     *
     * The frontend should display the member's
     * initials whenever avatarUrl is null.
     */
    avatarUrl: null,

    verifiedAt:
      member.activatedAt?.toISOString() ??
      null,
  };
}

function getTopPerformersPeriodRange(
  period: TopPerformersPeriod,
  now: Date,
): TopPerformersPeriodRange | null {
  if (period === "all-time") {
    return null;
  }

  const manilaDate = new Date(
    now.getTime() + MANILA_UTC_OFFSET_MS,
  );
  const year = manilaDate.getUTCFullYear();
  const month =
    period === "month"
      ? manilaDate.getUTCMonth()
      : 0;
  const endYear =
    period === "year"
      ? year + 1
      : year;
  const endMonth =
    period === "month"
      ? month + 1
      : 0;

  return {
    start: new Date(
      Date.UTC(year, month, 1) -
        MANILA_UTC_OFFSET_MS,
    ),
    end: new Date(
      Date.UTC(endYear, endMonth, 1) -
        MANILA_UTC_OFFSET_MS,
    ),
  };
}

function createActiveReferralWhere(
  period: TopPerformersPeriod,
  now: Date,
): Prisma.MemberWhereInput {
  const periodRange =
    getTopPerformersPeriodRange(
      period,
      now,
    );

  return {
    status: MemberStatus.ACTIVE,

    ...(periodRange
      ? {
          OR: [
            {
              activatedAt: {
                gte: periodRange.start,
                lt: periodRange.end,
              },
            },
            {
              activatedAt: null,
              createdAt: {
                gte: periodRange.start,
                lt: periodRange.end,
              },
            },
          ],
        }
      : {}),
  };
}

@Injectable()
export class MemberDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  /**
   * Returns the authenticated member's dashboard
   * wallet and commission statistics.
   *
   * The member is validated against the database.
   * The financial values currently start at zero
   * until wallet and transaction models are connected.
   */
  async getDashboardStats(
    memberId: string,
  ): Promise<MemberDashboardStatsResponse> {
    const member =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select: {
          id: true,
        },
      });

    if (!member) {
      throw new NotFoundException(
        "Member account was not found.",
      );
    }

    return {
      success: true,

      stats: {
        walletBalance: 0,
        walletGrowthPercent: 0,

        totalEarnings: 0,
        earningsGrowthPercent: 0,

        referralCommission: 0,
        referralCommissionGrowthPercent: 0,

        groupCommission: 0,
        groupCommissionGrowthPercent: 0,

        monthlyIncoming: 0,
        monthlyWithdrawals: 0,
      },
    };
  }

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

  async getRecentVerifiedMembers(): Promise<RecentVerifiedMembersResponse> {
    const recentMembers =
      await this.prisma.member.findMany({
        where: {
          status: MemberStatus.ACTIVE,
        },

        orderBy: [
          {
            activatedAt: "desc",
          },
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        take:
          RECENT_VERIFIED_MEMBERS_LIMIT,

        select:
          recentVerifiedMemberSelect,
      });

    return {
      success: true,

      members:
        recentMembers.map(
          mapRecentVerifiedMember,
        ),
    };
  }

  async getTopPerformers(
    requestedPeriod = "month",
  ): Promise<TopPerformersResponseDto> {
    if (
      !TOP_PERFORMERS_PERIODS.includes(
        requestedPeriod as TopPerformersPeriod,
      )
    ) {
      throw new BadRequestException(
        "period must be one of: month, year, all-time.",
      );
    }

    const period = requestedPeriod as TopPerformersPeriod;
    const now = new Date();
    const activeReferralWhere =
      createActiveReferralWhere(
        period,
        now,
      );

    const members = await this.prisma.member.findMany({
      where: {
        status: MemberStatus.ACTIVE,
        referredMembers: {
          some: activeReferralWhere,
        },
      },
      select: {
        id: true,
        membershipId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        profilePhoto: true,
        membershipType: true,
        status: true,
        _count: {
          select: {
            referredMembers: {
              where: activeReferralWhere,
            },
          },
        },
      },
    });

    const rankedMembers = members
      .map((member) => ({
        member,
        totalReferrals:
          member._count.referredMembers,
      }))
      .filter(({ totalReferrals }) => totalReferrals > 0)
      .sort(
        (left, right) =>
          right.totalReferrals - left.totalReferrals ||
          left.member.membershipId.localeCompare(
            right.member.membershipId,
          ) ||
          left.member.id.localeCompare(right.member.id),
      );

    const performers: TopPerformerDto[] = rankedMembers
      .slice(0, TOP_PERFORMERS_LIMIT)
      .map(({ member, totalReferrals }, index) => ({
        id: member.id,
        membershipId: member.membershipId,
        fullName: createFullName(
          member.firstName,
          member.middleName,
          member.lastName,
        ),
        profilePhoto: member.profilePhoto,
        membershipType: mapMembershipType(member.membershipType),
        status: mapMemberStatus(member.status),
        rank: index + 1,
        totalReferrals,
        period,
      }));

    return {
      success: true,
      period,
      performers,
      totalMembers: rankedMembers.length,
      generatedAt: now.toISOString(),
    };
  }

  async createGenealogyMember(
    sponsorMemberId: string,
    dto: CreateGenealogyMemberDto,
  ) {
    const sponsor =
      await this.prisma.member.findUnique({
        where: {
          id: sponsorMemberId,
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
        "Sponsor member account was not found.",
      );
    }

    if (
      sponsor.status !==
      MemberStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Your account must be active before you can add a member.",
      );
    }

    /*
     * Count only the direct referrals of the
     * authenticated sponsor.
     */
    const directReferralCount =
      await this.prisma.member.count({
        where: {
          sponsorId: sponsor.id,
        },
      });

    /*
     * Legacy Care placement rule:
     *
     * Direct members 1–3 go to the LEFT.
     * Direct member 4 onward goes to the RIGHT.
     */
    const calculatedPlacement:
      | "LEFT"
      | "RIGHT" =
      directReferralCount <
      DIRECT_LEFT_LIMIT
        ? "LEFT"
        : "RIGHT";

    const createdMember =
      await this.membersService.createMember({
        firstName:
          dto.firstName,

        middleName:
          dto.middleName,

        lastName:
          dto.lastName,

        address:
          dto.address,

        dateOfBirth:
          dto.dateOfBirth,

        email:
          dto.email,

        phone:
          dto.phone,

        username:
          dto.username,

        membershipType:
          dto.membershipType ??
          MembershipType.BASIC,

        activationCode:
          dto.activationCode,

        /*
         * Automatically use the authenticated
         * sponsor's referral code.
         */
        sponsorReferralCode:
          sponsor.referralCode,

        password:
          dto.password,

        confirmPassword:
          dto.confirmPassword,
      });

    return {
      success: true,

      message:
        calculatedPlacement === "LEFT"
          ? "Member successfully added to the left branch."
          : "Member successfully added to the right branch.",

      placement:
        calculatedPlacement,

      member:
        createdMember,
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

        select:
          genealogyMemberSelect,
      });

    if (!rootMember) {
      throw new NotFoundException(
        "Member account was not found.",
      );
    }

    /*
     * Load the authenticated member's direct
     * referrals in creation order.
     *
     * The first three become the left branch.
     * All later direct referrals become the
     * right branch.
     */
    const directReferrals =
      await this.prisma.member.findMany({
        where: {
          sponsorId:
            rootMember.id,
        },

        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],

        select:
          genealogyMemberSelect,
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
          member.status ===
          "active",
      ).length;

    const pendingMembers =
      visibleMembers.filter(
        (member) =>
          member.status ===
          "pending",
      ).length;

    const suspendedMembers =
      visibleMembers.filter(
        (member) =>
          member.status ===
          "suspended",
      ).length;

    const inactiveMembers =
      visibleMembers.filter(
        (member) =>
          member.status ===
          "inactive",
      ).length;

    const nextPlacement:
      GenealogyResponseDto["placementRules"]["nextPlacement"] =
      mappedDirectReferrals.length <
      DIRECT_LEFT_LIMIT
        ? "LEFT"
        : "RIGHT";

    return {
      success: true,

      root:
        mappedRoot,

      branches: {
        left:
          leftMembers,

        right:
          rightMembers,
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
