import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AnnouncementsService } from '../announcements/announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SatelliteNotificationListResponse } from './notifications.types';

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

// Satellite offices don't have per-account notification records yet — the
// only thing that currently reaches them is the published announcement
// feed, so this endpoint just re-shapes that as a notification list.
@Controller('satellite/notifications')
@UseGuards(JwtAuthGuard)
export class SatelliteNotificationsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async getNotifications(
    @Req() request: AuthenticatedSatelliteRequest,
  ): Promise<SatelliteNotificationListResponse> {
    assertSatelliteAccount(request);

    const response = await this.announcementsService.getPublicAnnouncements();

    return {
      notifications: response.announcements.map((announcement) => ({
        id: announcement.id,
        type: 'announcement' as const,
        title: announcement.title,
        content: announcement.description,
        priority: announcement.priority,
        createdAt: announcement.postedAt,
      })),
      total: response.total,
    };
  }
}
