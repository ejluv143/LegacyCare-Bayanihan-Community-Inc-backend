import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../admin/database/prisma/prisma.service';
import type { Notification } from '../generated/prisma/client';
import type {
  CreateNotificationInput,
  MemberNotificationListResponse,
  NotificationResponse,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((notification) =>
        this.toResponse(notification),
      ),
      total,
      unreadCount,
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
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true },
    });

    return this.findOwnedNotification(userId, notificationId);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
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
}
