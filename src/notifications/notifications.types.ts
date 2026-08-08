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
  // 'announcement' items are synthesized from published Announcements at
  // read time, not stored as Notification rows — see
  // NotificationsService.getMemberNotifications.
  type: Lowercase<NotificationType> | 'announcement';
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

// Satellite offices only ever see announcement broadcasts today (no
// per-account notification records exist), so this is a lighter shape
// than the member NotificationResponse — no userId/channel/isRead.
export interface SatelliteNotificationResponse {
  id: string;
  type: 'announcement';
  title: string;
  content: string;
  priority: string;
  createdAt: string;
}

export interface SatelliteNotificationListResponse {
  notifications: SatelliteNotificationResponse[];
  total: number;
}
