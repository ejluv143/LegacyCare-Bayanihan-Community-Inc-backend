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

import { AnnouncementsService } from '../announcements/announcements.service';
import type { AnnouncementResponse } from '../announcements/announcements.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
  SatelliteNotificationListResponse,
  SatelliteNotificationResponse,
} from './notifications.types';

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

function toNotification(
  announcement: AnnouncementResponse,
): SatelliteNotificationResponse {
  return {
    id: announcement.id,
    type: 'announcement',
    title: announcement.title,
    content: announcement.description,
    priority: announcement.priority,
    isRead: announcement.isRead,
    createdAt: announcement.postedAt,
  };
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
    const response = await this.announcementsService.getPublicAnnouncements(
      getSatelliteAccountId(request),
    );

    const notifications = response.announcements.map(toNotification);

    return {
      notifications,
      total: response.total,
      unreadCount: notifications.filter((notification) => !notification.isRead)
        .length,
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() request: AuthenticatedSatelliteRequest) {
    return this.announcementsService.markAllSatelliteAnnouncementsAsRead(
      getSatelliteAccountId(request),
    );
  }

  @Patch(':notificationId/read')
  async markAsRead(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('notificationId', announcementIdPipe) notificationId: string,
  ): Promise<SatelliteNotificationResponse> {
    const announcement =
      await this.announcementsService.markSatelliteAnnouncementAsRead(
        getSatelliteAccountId(request),
        notificationId,
      );

    return toNotification(announcement);
  }
}
