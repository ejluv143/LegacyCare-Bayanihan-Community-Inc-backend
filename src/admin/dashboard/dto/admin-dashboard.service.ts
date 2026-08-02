import { Injectable } from "@nestjs/common";

import {
  MemberStatus,
  MembershipType,
} from "../../../generated/prisma/client";

import { PrismaService } from "../../database/prisma/prisma.service";

import type {
  AdminDashboardMemberGrowthResponse,
  AdminDashboardOverviewResponse,
  AdminDashboardRecentMembersResponse,
  AdminMemberTotalsResponse,
} from "./admin-dashboard.types";

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /* =======================================================
     MEMBER TOTALS
  ======================================================= */

  async getMemberTotals():
    Promise<AdminMemberTotalsResponse> {
    const [
      registeredMembers,
      basicMembers,
      premiumMembers,
      totalBeneficiaries,
    ] = await Promise.all([
      this.prisma.member.count(),

      this.prisma.member.count({
        where: {
          membershipType:
            MembershipType.BASIC,
        },
      }),

      this.prisma.member.count({
        where: {
          membershipType:
            MembershipType.PREMIUM,
        },
      }),

      this.prisma.beneficiary.count(),
    ]);

    const totalMembers =
      registeredMembers +
      totalBeneficiaries;

    return {
      success: true,

      message:
        "Member and beneficiary totals retrieved successfully.",

      data: {
        totalMembers,

        registeredMembers,

        basicMembers,

        premiumMembers,

        totalBeneficiaries,
      },
    };
  }

  /* =======================================================
     DASHBOARD OVERVIEW
  ======================================================= */

  async getOverview():
    Promise<AdminDashboardOverviewResponse> {
    const [
      registeredMembers,
      totalBeneficiaries,
      activeMembers,
      pendingMembers,
      suspendedMembers,
    ] = await Promise.all([
      this.prisma.member.count(),

      this.prisma.beneficiary.count(),

      this.prisma.member.count({
        where: {
          status:
            MemberStatus.ACTIVE,
        },
      }),

      this.prisma.member.count({
        where: {
          status:
            MemberStatus.PENDING_ACTIVATION,
        },
      }),

      this.prisma.member.count({
        where: {
          status:
            MemberStatus.SUSPENDED,
        },
      }),
    ]);

    const totalMembers =
      registeredMembers +
      totalBeneficiaries;

    return {
      success: true,

      message:
        "Dashboard overview retrieved successfully.",

      data: {
        totalMembers,

        registeredMembers,

        totalBeneficiaries,

        activeMembers,

        pendingMembers,

        suspendedMembers,

        totalSatellites: 0,

        activeSatellites: 0,

        pendingSatellites: 0,

        totalTransactions: 0,

        totalClaims: 0,

        pendingClaims: 0,
      },
    };
  }

  /* =======================================================
     RECENT MEMBERS
  ======================================================= */

  async getRecentMembers():
    Promise<AdminDashboardRecentMembersResponse> {
    const members =
      await this.prisma.member.findMany({
        take: 10,

        orderBy: {
          createdAt: "desc",
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

          createdAt: true,
        },
      });

    return {
      success: true,

      message:
        "Recent members retrieved successfully.",

      data: members.map(
        (member) => ({
          id:
            member.id,

          membershipId:
            member.membershipId,

          firstName:
            member.firstName,

          middleName:
            member.middleName,

          lastName:
            member.lastName,

          username:
            member.username,

          email:
            member.email,

          phone:
            member.phone,

          membershipType:
            member.membershipType,

          status:
            member.status,

          memberSince:
            member.createdAt,

          createdAt:
            member.createdAt,
        }),
      ),
    };
  }

  /* =======================================================
     MEMBER GROWTH
  ======================================================= */

  async getMemberGrowth():
    Promise<AdminDashboardMemberGrowthResponse> {
    return {
      success: true,

      message:
        "Member growth retrieved successfully.",

      data: [],
    };
  }
}