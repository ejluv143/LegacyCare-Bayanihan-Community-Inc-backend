import type {
  NotificationChannel,
  NotificationType,
} from '../generated/prisma/enums';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  content: string;
  type?: NotificationType;
  channel?: NotificationChannel;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: Lowercase<NotificationType>;
  channel: Lowercase<NotificationChannel>;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberNotificationListResponse {
  notifications: NotificationResponse[];
  total: number;
  unreadCount: number;
}
