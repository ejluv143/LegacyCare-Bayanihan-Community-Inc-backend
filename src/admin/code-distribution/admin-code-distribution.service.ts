import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  GeneratedCodeStatus,
  SatelliteStatus,
} from '../../generated/prisma/client';

import { PrismaService } from '../database/prisma/prisma.service';

import { SendCodesDto } from './dto/send-codes.dto';

@Injectable()
export class AdminCodeDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     GET ACTIVE SATELLITES
  ========================================================= */

  async getActiveSatellites() {
    const satellites = await this.prisma.satellite.findMany({
      where: { status: SatelliteStatus.ACTIVE },
      orderBy: { satelliteName: 'asc' },
      select: {
        id: true,
        satelliteCode: true,
        satelliteName: true,
        city: true,
        province: true,
        status: true,
      },
    });

    return {
      success: true,

      data: {
        satellites: satellites.map((satellite) => ({
          id: satellite.id,
          satelliteCode: satellite.satelliteCode,
          satelliteName: satellite.satelliteName,
          city: satellite.city,
          province: satellite.province,
          status: 'active',
        })),
      },
    };
  }

  /* =========================================================
     SEND CODES
  ========================================================= */

  async sendCodes(dto: SendCodesDto) {
    if (dto.codeIds.length === 0) {
      throw new BadRequestException('No generated codes selected.');
    }

    const satellite = await this.prisma.satellite.findUnique({
      where: { id: dto.satelliteId },
      select: {
        id: true,
        satelliteCode: true,
        satelliteName: true,
        status: true,
      },
    });

    if (!satellite) {
      throw new NotFoundException('Satellite not found.');
    }

    if (satellite.status !== SatelliteStatus.ACTIVE) {
      throw new ConflictException('Satellite is not active.');
    }

    const codes = await this.prisma.generatedCode.findMany({
      where: { id: { in: dto.codeIds } },
    });

    if (codes.length !== dto.codeIds.length) {
      throw new NotFoundException('Some generated codes were not found.');
    }

    const unavailable = codes.filter(
      (code) => code.status !== GeneratedCodeStatus.AVAILABLE,
    );
    if (unavailable.length > 0) {
      throw new ConflictException('Some generated codes are not available.');
    }

    const now = new Date();

    await this.prisma.generatedCode.updateMany({
      where: { id: { in: dto.codeIds } },
      data: { updatedAt: now },
    });

    const assignedCodes = await this.prisma.generatedCode.findMany({
      where: { id: { in: dto.codeIds } },
      orderBy: { code: 'asc' },
    });

    return {
      success: true,

      message: `${assignedCodes.length} code${assignedCodes.length === 1 ? '' : 's'} successfully sent to ${satellite.satelliteName}.`,

      data: {
        satelliteId: satellite.id,
        satelliteCode: satellite.satelliteCode,
        satelliteName: satellite.satelliteName,
        assignedCount: assignedCodes.length,
        assignedAt: now.toISOString(),
        codes: assignedCodes.map((code) => ({
          id: code.id,
          code: code.code,
          category: code.category.toLowerCase().replace('_', '-'),
          status: 'assigned',
          activationType: code.activationType
            ? code.activationType.toLowerCase()
            : null,
          topUpAmount: code.topUpAmount,
          generatedAt: code.generatedAt.toISOString(),
          expiresAt: code.expiresAt?.toISOString() ?? null,
        })),
      },
    };
  }
}
