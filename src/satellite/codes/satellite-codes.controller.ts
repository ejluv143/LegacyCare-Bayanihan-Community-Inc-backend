import { Controller, Get, Param, Query } from '@nestjs/common';

import { SatelliteCodesService } from './satellite-codes.service';
import { SatelliteCodesQueryDto } from './dto/satellite-codes-query.dto';

@Controller('satellite/codes')
export class SatelliteCodesController {
  constructor(private readonly satelliteCodesService: SatelliteCodesService) {}

  /* =========================================================
     GET ASSIGNED CODES
  ========================================================= */

  @Get()
  getAssignedCodes(
    @Query()
    query: SatelliteCodesQueryDto,
  ) {
    return this.satelliteCodesService.getAssignedCodes(query);
  }

  /* =========================================================
     GET SUMMARY
  ========================================================= */

  @Get('summary')
  getSummary() {
    return this.satelliteCodesService.getSummary();
  }

  /* =========================================================
     GET SINGLE CODE
  ========================================================= */

  @Get(':codeId')
  getCodeById(
    @Param('codeId')
    codeId: string,
  ) {
    return this.satelliteCodesService.getCodeById(codeId);
  }
}
