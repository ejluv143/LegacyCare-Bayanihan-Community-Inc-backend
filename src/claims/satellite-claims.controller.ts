import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClaimsService } from './claims.service';
import { SubmitSatelliteReviewDto } from './dto/submit-satellite-review.dto';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    satelliteId?: string;
    accountType?: string;
    username?: string;
  };
}

const claimIdPipe = new ParseUUIDPipe({ version: '4' });

function getSatelliteId(request: AuthenticatedSatelliteRequest): string {
  if (request.user?.accountType !== 'satellite' || !request.user.satelliteId) {
    throw new ForbiddenException('A satellite account is required.');
  }

  return request.user.satelliteId;
}

@Controller('satellite/claims')
@UseGuards(JwtAuthGuard)
export class SatelliteClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  getClaims(@Req() request: AuthenticatedSatelliteRequest) {
    return this.claimsService.getSatelliteClaims(getSatelliteId(request));
  }

  @Get(':claimId')
  getClaimById(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('claimId', claimIdPipe) claimId: string,
  ) {
    return this.claimsService.getSatelliteClaimById(
      getSatelliteId(request),
      claimId,
    );
  }

  @Post(':claimId/review')
  submitReview(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() dto: SubmitSatelliteReviewDto,
  ) {
    return this.claimsService.submitSatelliteReview(
      getSatelliteId(request),
      claimId,
      request.user?.username ?? null,
      dto,
    );
  }
}
