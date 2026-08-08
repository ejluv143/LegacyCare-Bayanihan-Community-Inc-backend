import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    accountType?: string;
  };
}

function assertSatelliteAccount(request: AuthenticatedSatelliteRequest): void {
  if (request.user?.accountType !== 'satellite') {
    throw new ForbiddenException('A satellite account is required.');
  }
}

@Controller('satellite/announcements')
@UseGuards(JwtAuthGuard)
export class SatelliteAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  getAnnouncements(@Req() request: AuthenticatedSatelliteRequest) {
    assertSatelliteAccount(request);

    return this.announcementsService.getPublicAnnouncements();
  }
}
