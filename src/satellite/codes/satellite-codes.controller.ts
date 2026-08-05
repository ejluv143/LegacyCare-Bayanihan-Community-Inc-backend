import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SatelliteCodesService } from './satellite-codes.service';
import { SatelliteCodesQueryDto } from './dto/satellite-codes-query.dto';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    satelliteId?: string;
    accountType?: string;
  };
}

function getSatelliteId(request: AuthenticatedSatelliteRequest): string {
  if (request.user?.accountType !== 'satellite' || !request.user.satelliteId) {
    throw new ForbiddenException('A satellite account is required.');
  }

  return request.user.satelliteId;
}

@Controller('satellite/codes')
@UseGuards(JwtAuthGuard)
export class SatelliteCodesController {
  constructor(private readonly satelliteCodesService: SatelliteCodesService) {}

  /* =========================================================
     GET ASSIGNED CODES
  ========================================================= */

  @Get()
  getAssignedCodes(
    @Req()
    request: AuthenticatedSatelliteRequest,
    @Query()
    query: SatelliteCodesQueryDto,
  ) {
    return this.satelliteCodesService.getAssignedCodes(
      getSatelliteId(request),
      query,
    );
  }

  /* =========================================================
     GET SUMMARY
  ========================================================= */

  @Get('summary')
  getSummary(@Req() request: AuthenticatedSatelliteRequest) {
    return this.satelliteCodesService.getSummary(getSatelliteId(request));
  }

  /* =========================================================
     GET SINGLE CODE
  ========================================================= */

  @Get(':codeId')
  getCodeById(
    @Req()
    request: AuthenticatedSatelliteRequest,
    @Param('codeId')
    codeId: string,
  ) {
    return this.satelliteCodesService.getCodeById(
      getSatelliteId(request),
      codeId,
    );
  }
}
