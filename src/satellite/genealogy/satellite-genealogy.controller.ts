import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SatelliteGenealogyService } from './satellite-genealogy.service';

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

/*
 * Read-only: a satellite can browse its own clients' genealogy
 * networks, but never add, move, or edit a member from here. Adding
 * members happens through /satellite/members/register, which goes
 * through the regular registration flow instead.
 */
@Controller('satellite/genealogy')
@UseGuards(JwtAuthGuard)
export class SatelliteGenealogyController {
  constructor(
    private readonly satelliteGenealogyService: SatelliteGenealogyService,
  ) {}

  @Get()
  getGenealogyClients(@Req() request: AuthenticatedSatelliteRequest) {
    return this.satelliteGenealogyService.getGenealogyClients(
      getSatelliteId(request),
    );
  }

  @Get(':memberId/tree')
  getGenealogyTree(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('memberId') memberId: string,
  ) {
    return this.satelliteGenealogyService.getGenealogyTree(
      getSatelliteId(request),
      memberId,
    );
  }
}
