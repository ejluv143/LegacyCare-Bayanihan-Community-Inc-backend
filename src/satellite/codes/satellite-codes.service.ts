import { Injectable, NotFoundException } from '@nestjs/common';

import { SatelliteCodesQueryDto } from './dto/satellite-codes-query.dto';

@Injectable()
export class SatelliteCodesService {
  /* =========================================================
     GET ASSIGNED CODES
  ========================================================= */

  getAssignedCodes(query: SatelliteCodesQueryDto) {
    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    return {
      success: true,

      data: {
        codes: [],

        pagination: {
          page,

          limit,

          total: 0,

          totalPages: 0,
        },
      },
    };
  }

  /* =========================================================
     GET SUMMARY
  ========================================================= */

  getSummary() {
    return {
      success: true,

      data: {
        summary: {
          totalAssigned: 0,

          availableCodes: 0,

          usedCodes: 0,

          expiredCodes: 0,

          disabledCodes: 0,
        },
      },
    };
  }

  /* =========================================================
     GET SINGLE CODE
  ========================================================= */

  getCodeById(codeId: string): never {
    throw new NotFoundException(`Assigned code ${codeId} was not found.`);
  }
}
