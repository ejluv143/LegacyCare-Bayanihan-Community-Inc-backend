import { Injectable } from "@nestjs/common";

import { PrismaService } from "../admin/database/prisma/prisma.service";

export interface MemberDashboardTotals {
  memberCount: number;
  beneficiaryCount: number;
  totalMembers: number;
}

@Injectable()
export class MemberDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberTotals(): Promise<MemberDashboardTotals> {
    const [memberCount, beneficiaryCount] = await this.prisma.$transaction([
      this.prisma.member.count(),
      this.prisma.beneficiary.count(),
    ]);

    return {
      memberCount,
      beneficiaryCount,
      totalMembers: memberCount + beneficiaryCount,
    };
  }
}