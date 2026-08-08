import { Injectable } from '@nestjs/common';

import { PrismaService } from '../admin/database/prisma/prisma.service';
import { SatelliteStatus } from '../generated/prisma/client';

export interface PublicSatelliteListItem {
  id: string;
  satelliteName: string;
  satelliteCode: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
}

export interface PublicSatelliteListResponse {
  satellites: PublicSatelliteListItem[];
}

@Injectable()
export class SatellitesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public, unauthenticated directory of active satellites. Backs
   * the public registration form's optional "Servicing Satellite"
   * picker (register-content.tsx / public-satellites-service.ts).
   *
   * Deliberately exposes only identity/location fields -- no manager
   * PII, commission rate, or payout account details, unlike the
   * admin-only /admin/satellites endpoints.
   */
  async listPublicSatellites(): Promise<PublicSatelliteListResponse> {
    const satellites = await this.prisma.satellite.findMany({
      where: {
        status: SatelliteStatus.ACTIVE,
      },

      select: {
        id: true,
        satelliteName: true,
        satelliteCode: true,
        region: true,
        province: true,
        city: true,
        barangay: true,
      },

      orderBy: {
        satelliteName: 'asc',
      },
    });

    return { satellites };
  }
}
