import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AnnouncementsService } from '../announcements/announcements.service';
import type { AnnouncementResponse } from '../announcements/announcements.types';
import { PrismaService } from '../admin/database/prisma/prisma.service';
import type { Notification } from '../generated/prisma/client';
import type {
  CreateNotificationInput,
  MemberNotificationListResponse,
  NotificationResponse,
} from './notifications.types';

const ANNOUNCEMENT_ID_PREFIX = 'announcement:';

const MAX_MERGED_NOTIFICATIONS = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationResponse> {
    const title = input.title.trim();
    const content = input.content.trim();

    if (!title || !content) {
      throw new BadRequestException(
        'Notification title and content are required.',
      );
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title,
        content,
        type: input.type,
        channel: input.channel,
      },
    });

    // EMAIL and PUSH provider dispatch can be added here. Persisting first
    // keeps the in-app feed as the source of truth if a provider is unavailable.
    return this.toResponse(notification);
  }

  async createNotifications(
    inputs: CreateNotificationInput[],
  ): Promise<NotificationResponse[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.prisma
      .$transaction(
        inputs.map((input) => {
          const title = input.title.trim();
          const content = input.content.trim();

          if (!title || !content) {
            throw new BadRequestException(
              'Every notification requires a title and content.',
            );
          }

          return this.prisma.notification.create({
            data: {
              userId: input.userId,
              title,
              content,
              type: input.type,
              channel: input.channel,
            },
          });
        }),
      )
      .then((notifications) =>
        notifications.map((notification) => this.toResponse(notification)),
      );
  }

  async getUserNotifications(
    userId: string,
    options?: { unreadOnly?: boolean },
  ): Promise<MemberNotificationListResponse> {
    const where = {
      userId,
      ...(options?.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount, announcementsResponse] =
      await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_MERGED_NOTIFICATIONS,
        }),
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({ where: { userId, isRead: false } }),
        // Announcements are published broadcasts, not per-user rows, so
        // they're merged into the notification feed here rather than
        // stored as Notification records.
        this.announcementsService.getMemberAnnouncements(userId),
      ]);

    const announcementItems = announcementsResponse.announcements
      .filter((announcement) => !options?.unreadOnly || !announcement.isRead)
      .map((announcement) => this.toAnnouncementResponse(announcement));

    const announcementUnreadCount = announcementsResponse.announcements.filter(
      (announcement) => !announcement.isRead,
    ).length;

    const merged = [
      ...notifications.map((notification) => this.toResponse(notification)),
      ...announcementItems,
    ]
      .sort(
        (first, second) =>
          Date.parse(second.createdAt) - Date.parse(first.createdAt),
      )
      .slice(0, MAX_MERGED_NOTIFICATIONS);

    return {
      notifications: merged,
      total: total + announcementsResponse.total,
      unreadCount: unreadCount + announcementUnreadCount,
    };
  }

  getMemberNotifications(
    memberId: string,
    options?: { unreadOnly?: boolean },
  ): Promise<MemberNotificationListResponse> {
    return this.getUserNotifications(memberId, options);
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    if (notificationId.startsWith(ANNOUNCEMENT_ID_PREFIX)) {
      const announcementId = notificationId.slice(
        ANNOUNCEMENT_ID_PREFIX.length,
      );

      const announcement = await this.announcementsService.markAsRead(
        userId,
        announcementId,
      );

      return this.toAnnouncementResponse(announcement);
    }

    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true },
    });

    return this.findOwnedNotification(userId, notificationId);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const [realResult, announcementResult] = await Promise.all([
      this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      }),
      this.announcementsService.markAllAsRead(userId),
    ]);

    return { count: realResult.count + announcementResult.count };
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.findOwnedNotification(
      userId,
      notificationId,
    );

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return notification;
  }

  private async findOwnedNotification(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return this.toResponse(notification);
  }

  private toResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type.toLowerCase() as NotificationResponse['type'],
      channel:
        notification.channel.toLowerCase() as NotificationResponse['channel'],
      title: notification.title,
      content: notification.content,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }

  private toAnnouncementResponse(
    announcement: AnnouncementResponse,
  ): NotificationResponse {
    return {
      id: `${ANNOUNCEMENT_ID_PREFIX}${announcement.id}`,
      userId: '',
      type: 'announcement',
      channel: 'in_app',
      title: announcement.title,
      content: announcement.description,
      isRead: announcement.isRead,
      createdAt: announcement.postedAt,
      updatedAt: announcement.updatedAt,
    };
  }
}
