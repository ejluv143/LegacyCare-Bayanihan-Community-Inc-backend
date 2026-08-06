import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';

import {
  NotificationChannel,
  NotificationType,
} from '../generated/prisma/enums';
import type { PrismaService } from '../admin/database/prisma/prisma.service';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notification = {
    id: 'notification-1',
    userId: 'member-1',
    type: NotificationType.INFO,
    channel: NotificationChannel.IN_APP,
    title: 'Account update',
    content: 'Your account was updated.',
    isRead: false,
    createdAt: new Date('2026-08-06T01:00:00.000Z'),
    updatedAt: new Date('2026-08-06T01:00:00.000Z'),
  };

  const prisma = {
    notification: {
      create: jest.fn<(input: unknown) => Promise<typeof notification>>(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn<(input: unknown) => Promise<{ count: number }>>(),
      findFirst: jest.fn<() => Promise<typeof notification | null>>(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new NotificationsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a notification before creating it', async () => {
    prisma.notification.create.mockResolvedValue(notification);

    await service.createNotification({
      userId: 'member-1',
      title: '  Account update  ',
      content: '  Your account was updated.  ',
      type: NotificationType.INFO,
      channel: NotificationChannel.IN_APP,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'member-1',
        title: 'Account update',
        content: 'Your account was updated.',
        type: NotificationType.INFO,
        channel: NotificationChannel.IN_APP,
      },
    });
  });

  it('rejects blank notification content', async () => {
    await expect(
      service.createNotification({
        userId: 'member-1',
        title: ' ',
        content: 'Message',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks only the user-owned notification as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue({
      ...notification,
      isRead: true,
    });

    const result = await service.markAsRead('member-1', 'notification-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'notification-1',
        userId: 'member-1',
        isRead: false,
      },
      data: { isRead: true },
    });
    expect(result.isRead).toBe(true);
  });

  it("does not reveal another user's notification", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead('member-1', 'notification-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
