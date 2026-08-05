import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GeneratedCodeCategory,
  GeneratedCodeStatus,
  Prisma,
  type GeneratedCode,
} from '../../generated/prisma/client';

import { PrismaService } from '../../admin/database/prisma/prisma.service';

import { SatelliteCodesQueryDto } from './dto/satellite-codes-query.dto';

@Injectable()
export class SatelliteCodesService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     GET ASSIGNED CODES
  ========================================================= */

  async getAssignedCodes(satelliteId: string, query: SatelliteCodesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = this.buildWhere(satelliteId, query);

    const [total, codes] = await this.prisma.$transaction([
      this.prisma.generatedCode.count({ where }),
      this.prisma.generatedCode.findMany({
        where,
        orderBy: { assignedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      success: true,

      data: {
        codes: codes.map((code) => this.mapCode(code)),

        pagination: {
          page,

          limit,

          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  /* =========================================================
     GET SUMMARY
  ========================================================= */

  async getSummary(satelliteId: string) {
    const grouped = await this.prisma.generatedCode.groupBy({
      by: ['status'],
      where: { assignedSatelliteId: satelliteId },
      _count: { _all: true },
    });

    const counts = new Map(
      grouped.map((entry) => [entry.status, entry._count._all]),
    );

    const availableCodes = counts.get(GeneratedCodeStatus.ASSIGNED) ?? 0;
    const usedCodes = counts.get(GeneratedCodeStatus.USED) ?? 0;
    const expiredCodes = counts.get(GeneratedCodeStatus.EXPIRED) ?? 0;
    const disabledCodes = counts.get(GeneratedCodeStatus.DISABLED) ?? 0;
    return {
      success: true,

      data: {
        summary: {
          totalAssigned:
            availableCodes + usedCodes + expiredCodes + disabledCodes,
          availableCodes,
          usedCodes,
          expiredCodes,
          disabledCodes,
        },
      },
    };
  }

  /* =========================================================
     GET SINGLE CODE
  ========================================================= */

  async getCodeById(satelliteId: string, codeId: string) {
    const code = await this.prisma.generatedCode.findFirst({
      where: {
        id: codeId,
        assignedSatelliteId: satelliteId,
      },
    });

    if (!code) {
      throw new NotFoundException(`Assigned code ${codeId} was not found.`);
    }

    return {
      success: true,
      data: this.mapCode(code),
    };
  }

  private buildWhere(
    satelliteId: string,
    query: SatelliteCodesQueryDto,
  ): Prisma.GeneratedCodeWhereInput {
    const where: Prisma.GeneratedCodeWhereInput = {
      assignedSatelliteId: satelliteId,
    };

    if (query.search?.trim()) {
      where.code = { contains: query.search.trim() };
    }

    if (query.category && query.category !== 'all') {
      where.category =
        query.category === 'top-up'
          ? GeneratedCodeCategory.TOP_UP
          : query.category === 'beneficiary'
            ? GeneratedCodeCategory.BENEFICIARY
            : GeneratedCodeCategory.ACTIVATION;
    }

    if (query.status && query.status !== 'all') {
      where.status =
        query.status === 'available'
          ? GeneratedCodeStatus.ASSIGNED
          : query.status === 'used'
            ? GeneratedCodeStatus.USED
            : query.status === 'expired'
              ? GeneratedCodeStatus.EXPIRED
              : GeneratedCodeStatus.DISABLED;
    }

    return where;
  }

  private mapCode(code: GeneratedCode) {
    return {
      id: code.id,
      code: code.code,
      category: code.category.toLowerCase().replace('_', '-'),
      status:
        code.status === GeneratedCodeStatus.ASSIGNED
          ? 'available'
          : code.status.toLowerCase(),
      activationType: code.activationType?.toLowerCase() ?? null,
      topUpAmount: code.topUpAmount,
      assignedAt: code.assignedAt?.toISOString() ?? null,
      expiresAt: code.expiresAt?.toISOString() ?? null,
      usedAt: code.usedAt?.toISOString() ?? null,
      usedByMemberId: code.usedByMemberId,
      usedByMemberName: code.usedByMemberName,
      assignedByAdminId: code.generatedByAdminId,
      assignedByAdminName: code.generatedByAdminName,
    };
  }
}
