import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    sub?: string;
    accountType?: string;
  };
}

const announcementIdPipe = new ParseUUIDPipe({ version: '4' });

function getSatelliteAccountId(request: AuthenticatedSatelliteRequest): string {
  if (request.user?.accountType !== 'satellite' || !request.user.sub) {
    throw new ForbiddenException('A satellite account is required.');
  }

  return request.user.sub;
}

@Controller('satellite/announcements')
@UseGuards(JwtAuthGuard)
export class SatelliteAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  getAnnouncements(@Req() request: AuthenticatedSatelliteRequest) {
    return this.announcementsService.getPublicAnnouncements(
      getSatelliteAccountId(request),
    );
  }

  @Patch(':announcementId/read')
  markAsRead(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('announcementId', announcementIdPipe) announcementId: string,
  ) {
    return this.announcementsService.markSatelliteAnnouncementAsRead(
      getSatelliteAccountId(request),
      announcementId,
    );
  }
}
