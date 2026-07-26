import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  MemberStatus,
  MembershipType,
} from "../generated/prisma/client";

import { PrismaService } from "../admin/database/prisma/prisma.service";
import { MembersService } from "../members/members.service";

import type { CreateGenealogyMemberDto } from "./dto/create-genealogy-member.dto";

import type {
  GenealogyMemberDto,
  GenealogyResponseDto,
} from "./member-dashboard.types";

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

    membershipType: mapMembershipType(
      member.membershipType,
    ),

    /*
     * The current Prisma selection does not
     * include a member profile image field.
     *
     * The frontend can display initials when
     * avatarUrl is null.
     */
    avatarUrl: null,

    verifiedAt:
      member.activatedAt?.toISOString() ??
      null,
  };
}

@Injectable()
export class MemberDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
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
