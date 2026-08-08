import type {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementType,
} from '../generated/prisma/enums';

export interface AnnouncementResponse {
  id: string;
  type: Lowercase<AnnouncementType>;
  title: string;
  description: string;
  content: string;
  priority: Lowercase<AnnouncementPriority>;
  status: Lowercase<AnnouncementStatus>;
  postedBy: string | null;
  postedAt: string;
  expiresAt: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementListResponse {
  announcements: AnnouncementResponse[];
  total: number;
}

export interface CreateAnnouncementInput {
  type?: AnnouncementType;
  title: string;
  description: string;
  content: string;
  priority?: AnnouncementPriority;
  postedBy?: string;
  publishAt?: string;
  expiresAt?: string;
  deceasedMemberId?: string;
}

export interface DeathAssessmentPreviewResponse {
  announcementId: string;
  deceasedMemberId: string;
  deceasedMemberName: string;
  baseAmount: number;
  perBeneficiaryAmount: number;
  affectedMemberCount: number;
  totalAmount: number;
  alreadyProcessed: boolean;
  processedAt: string | null;
}

export interface DeathAssessmentResult {
  announcementId: string;
  processedAt: string;
  affectedMemberCount: number;
  totalAmount: number;
}
