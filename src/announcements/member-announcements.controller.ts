import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('member/announcements')
@UseGuards(JwtAuthGuard)
export class MemberAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  getAnnouncements(@Req() request: AuthenticatedRequest) {
    return this.announcementsService.getMemberAnnouncements(request.user.sub);
  }

  @Patch(':announcementId/read')
  markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('announcementId') announcementId: string,
  ) {
    return this.announcementsService.markAsRead(
      request.user.sub,
      announcementId,
    );
  }
}
