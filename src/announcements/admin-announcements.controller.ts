import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

interface AuthenticatedAdminRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    adminId?: string;
  };
}

const announcementIdPipe = new ParseUUIDPipe({ version: '4' });

function getAdminId(request: AuthenticatedAdminRequest): string | null {
  return request.user?.adminId ?? request.user?.id ?? request.user?.sub ?? null;
}

@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  listAnnouncements() {
    return this.announcementsService.adminListAnnouncements();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.announcementsService.createAnnouncement(
      dto,
      getAdminId(request),
    );
  }

  @Get(':announcementId/death-assessment')
  getDeathAssessmentPreview(
    @Param('announcementId', announcementIdPipe) announcementId: string,
  ) {
    return this.announcementsService.getDeathAssessmentPreview(announcementId);
  }

  // The explicit "process" action the admin triggers after reviewing the
  // preview above. This is what actually deducts money from every member's
  // wallet — it never happens automatically on announcement creation.
  @Post(':announcementId/death-assessment/process')
  @HttpCode(HttpStatus.OK)
  processDeathAssessment(
    @Param('announcementId', announcementIdPipe) announcementId: string,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.announcementsService.processDeathAssessment(
      announcementId,
      getAdminId(request),
    );
  }
}
