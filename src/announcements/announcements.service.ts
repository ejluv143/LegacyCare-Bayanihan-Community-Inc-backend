import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Decimal } from '@prisma/client/runtime/client';

import { PrismaService } from '../admin/database/prisma/prisma.service';

import type { Announcement, Prisma } from '../generated/prisma/client';
import {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementType,
  MemberStatus,
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';

import {
  DEATH_ASSESSMENT_BASE_AMOUNT,
  DEATH_ASSESSMENT_PER_BENEFICIARY_AMOUNT,
  MAX_ADMIN_ANNOUNCEMENTS_PER_PAGE,
  MAX_ANNOUNCEMENTS_PER_PAGE,
} from './announcements.constants';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import type {
  AnnouncementListResponse,
  AnnouncementResponse,
  DeathAssessmentPreviewResponse,
  DeathAssessmentResult,
} from './announcements.types';

function buildFullName(
  firstName: string,
  middleName: string | null,
  lastName: string,
): string {
  return [firstName, middleName, lastName]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(' ');
}

function roundMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;

  return Object.is(rounded, -0) ? 0 : rounded;
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     MEMBER-FACING
  ========================================================= */

  async getMemberAnnouncements(
    memberId: string,
  ): Promise<AnnouncementListResponse> {
    const now = new Date();
    const where = this.visibleAnnouncementWhere(now);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ publishAt: 'desc' }, { id: 'desc' }],
        take: MAX_ANNOUNCEMENTS_PER_PAGE,
        include: {
          reads: {
            where: { memberId },
            select: { id: true },
          },
        },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      announcements: rows.map((row) =>
        this.toResponse(row, now, row.reads.length > 0),
      ),
      total,
    };
  }

  async markAsRead(
    memberId: string,
    announcementId: string,
  ): Promise<AnnouncementResponse> {
    const now = new Date();

    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, ...this.visibleAnnouncementWhere(now) },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    await this.prisma.announcementRead.upsert({
      where: {
        announcementId_memberId: { announcementId, memberId },
      },
      create: { announcementId, memberId },
      update: {},
    });

    return this.toResponse(announcement, now, true);
  }

  // Marks every currently-visible announcement this member hasn't read yet
  // as read. Used when the member notification feed's "mark all read"
  // action needs to cover announcement-sourced items too.
  async markAllAsRead(memberId: string): Promise<{ count: number }> {
    const now = new Date();

    const visible = await this.prisma.announcement.findMany({
      where: this.visibleAnnouncementWhere(now),
      select: { id: true },
    });

    if (visible.length === 0) {
      return { count: 0 };
    }

    const alreadyRead = await this.prisma.announcementRead.findMany({
      where: {
        memberId,
        announcementId: { in: visible.map((announcement) => announcement.id) },
      },
      select: { announcementId: true },
    });

    const alreadyReadIds = new Set(
      alreadyRead.map((entry) => entry.announcementId),
    );

    const unreadIds = visible
      .map((announcement) => announcement.id)
      .filter((id) => !alreadyReadIds.has(id));

    if (unreadIds.length === 0) {
      return { count: 0 };
    }

    const result = await this.prisma.announcementRead.createMany({
      data: unreadIds.map((announcementId) => ({ announcementId, memberId })),
    });

    return { count: result.count };
  }

  /* =========================================================
     SATELLITE-FACING
  ========================================================= */

  async getPublicAnnouncements(): Promise<AnnouncementListResponse> {
    const now = new Date();
    const where = this.visibleAnnouncementWhere(now);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ publishAt: 'desc' }, { id: 'desc' }],
        take: MAX_ANNOUNCEMENTS_PER_PAGE,
        include: {
          deceasedMember: {
            select: { firstName: true, middleName: true, lastName: true },
          },
        },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      announcements: rows.map((row) => this.toSatelliteResponse(row, now)),
      total,
    };
  }

  /* =========================================================
     ADMIN-FACING
  ========================================================= */

  async adminListAnnouncements(): Promise<AnnouncementListResponse> {
    const now = new Date();

    const rows = await this.prisma.announcement.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_ADMIN_ANNOUNCEMENTS_PER_PAGE,
    });

    return {
      announcements: rows.map((row) => this.toResponse(row, now, false)),
      total: rows.length,
    };
  }

  async createAnnouncement(
    dto: CreateAnnouncementDto,
    adminId: string | null,
  ): Promise<AnnouncementResponse> {
    const type = dto.type ?? AnnouncementType.GENERAL;
    const title = dto.title.trim();
    const description = dto.description.trim();
    const content = dto.content.trim();

    if (!title || !description || !content) {
      throw new BadRequestException(
        'Title, description, and content are required.',
      );
    }

    if (type === AnnouncementType.DEATH) {
      if (!dto.deceasedMemberId) {
        throw new BadRequestException(
          'A deceased member must be selected for a death announcement.',
        );
      }

      const deceasedMember = await this.prisma.member.findUnique({
        where: { id: dto.deceasedMemberId },
        select: { id: true },
      });

      if (!deceasedMember) {
        throw new NotFoundException('The selected member was not found.');
      }
    } else if (dto.deceasedMemberId) {
      throw new BadRequestException(
        'deceasedMemberId is only applicable to death announcements.',
      );
    }

    const now = new Date();

    const announcement = await this.prisma.announcement.create({
      data: {
        type,
        title,
        description,
        content,
        priority: dto.priority ?? AnnouncementPriority.NORMAL,
        postedBy: dto.postedBy?.trim() || null,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : now,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        deceasedMemberId:
          type === AnnouncementType.DEATH ? dto.deceasedMemberId : null,
        createdByAdminId: adminId,
      },
    });

    return this.toResponse(announcement, now, false);
  }

  async getDeathAssessmentPreview(
    announcementId: string,
  ): Promise<DeathAssessmentPreviewResponse> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        deceasedMember: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    if (
      announcement.type !== AnnouncementType.DEATH ||
      !announcement.deceasedMemberId ||
      !announcement.deceasedMember
    ) {
      throw new BadRequestException(
        'Only death announcements have a death assessment.',
      );
    }

    const activeMembers = await this.prisma.member.findMany({
      where: {
        status: MemberStatus.ACTIVE,
        id: { not: announcement.deceasedMemberId },
      },
      select: { _count: { select: { beneficiaries: true } } },
    });

    const totalAmount = activeMembers.reduce(
      (sum, member) =>
        sum +
        DEATH_ASSESSMENT_BASE_AMOUNT +
        DEATH_ASSESSMENT_PER_BENEFICIARY_AMOUNT * member._count.beneficiaries,
      0,
    );

    return {
      announcementId: announcement.id,
      deceasedMemberId: announcement.deceasedMemberId,
      deceasedMemberName: buildFullName(
        announcement.deceasedMember.firstName,
        announcement.deceasedMember.middleName,
        announcement.deceasedMember.lastName,
      ),
      baseAmount: DEATH_ASSESSMENT_BASE_AMOUNT,
      perBeneficiaryAmount: DEATH_ASSESSMENT_PER_BENEFICIARY_AMOUNT,
      affectedMemberCount: activeMembers.length,
      totalAmount: roundMoney(totalAmount),
      alreadyProcessed: announcement.assessmentProcessedAt !== null,
      processedAt: announcement.assessmentProcessedAt
        ? announcement.assessmentProcessedAt.toISOString()
        : null,
    };
  }

  async processDeathAssessment(
    announcementId: string,
    adminId: string | null,
  ): Promise<DeathAssessmentResult> {
    const now = new Date();

    return this.prisma.$transaction(
      async (transaction) => {
        const announcement = await transaction.announcement.findUnique({
          where: { id: announcementId },
          include: {
            deceasedMember: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
          },
        });

        if (!announcement) {
          throw new NotFoundException('Announcement not found.');
        }

        if (
          announcement.type !== AnnouncementType.DEATH ||
          !announcement.deceasedMemberId ||
          !announcement.deceasedMember
        ) {
          throw new BadRequestException(
            'Only death announcements can be processed for a death assessment.',
          );
        }

        if (announcement.assessmentProcessedAt) {
          throw new ConflictException(
            'This death assessment has already been processed.',
          );
        }

        // Atomically claim the announcement so a duplicate click (or a
        // concurrent request) cannot charge members twice.
        const claim = await transaction.announcement.updateMany({
          where: { id: announcementId, assessmentProcessedAt: null },
          data: {
            assessmentProcessedAt: now,
            assessmentProcessedByAdminId: adminId,
          },
        });

        if (claim.count !== 1) {
          throw new ConflictException(
            'This death assessment has already been processed.',
          );
        }

        const activeMembers = await transaction.member.findMany({
          where: {
            status: MemberStatus.ACTIVE,
            id: { not: announcement.deceasedMemberId },
          },
          select: { id: true, _count: { select: { beneficiaries: true } } },
        });

        const deceasedName = buildFullName(
          announcement.deceasedMember.firstName,
          announcement.deceasedMember.middleName,
          announcement.deceasedMember.lastName,
        );

        let totalAmount = 0;

        const transactionsData = activeMembers.map((member) => {
          const amount =
            DEATH_ASSESSMENT_BASE_AMOUNT +
            DEATH_ASSESSMENT_PER_BENEFICIARY_AMOUNT *
              member._count.beneficiaries;

          totalAmount += amount;

          return {
            memberId: member.id,
            type: WalletTransactionType.ADJUSTMENT,
            direction: WalletTransactionDirection.DEBIT,
            status: WalletTransactionStatus.COMPLETED,
            amount: new Decimal(amount),
            sourceKey: `death-assessment:${announcementId}:${member.id}`,
            description: `Mutual aid contribution in memory of ${deceasedName}.`,
            createdAt: now,
          };
        });

        if (transactionsData.length > 0) {
          await transaction.walletTransaction.createMany({
            data: transactionsData,
          });
        }

        totalAmount = roundMoney(totalAmount);

        await transaction.announcement.update({
          where: { id: announcementId },
          data: {
            assessmentMemberCount: activeMembers.length,
            assessmentTotalAmount: new Decimal(totalAmount),
          },
        });

        await transaction.member.update({
          where: { id: announcement.deceasedMemberId },
          data: { status: MemberStatus.DECEASED },
        });

        return {
          announcementId,
          processedAt: now.toISOString(),
          affectedMemberCount: activeMembers.length,
          totalAmount,
        };
      },
      { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 },
    );
  }

  /* =========================================================
     SHARED HELPERS
  ========================================================= */

  private visibleAnnouncementWhere(now: Date): Prisma.AnnouncementWhereInput {
    return {
      status: {
        in: [AnnouncementStatus.PUBLISHED, AnnouncementStatus.SCHEDULED],
      },
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
  }

  private computeEffectiveStatus(
    announcement: Pick<Announcement, 'status' | 'publishAt' | 'expiresAt'>,
    now: Date,
  ): AnnouncementStatus {
    if (announcement.status === AnnouncementStatus.EXPIRED) {
      return AnnouncementStatus.EXPIRED;
    }

    if (
      announcement.expiresAt &&
      announcement.expiresAt.getTime() <= now.getTime()
    ) {
      return AnnouncementStatus.EXPIRED;
    }

    if (announcement.publishAt.getTime() > now.getTime()) {
      return AnnouncementStatus.SCHEDULED;
    }

    return AnnouncementStatus.PUBLISHED;
  }

  private toResponse(
    announcement: Announcement,
    now: Date,
    isRead: boolean,
  ): AnnouncementResponse {
    return {
      id: announcement.id,
      type: announcement.type.toLowerCase() as Lowercase<AnnouncementType>,
      title: announcement.title,
      description: announcement.description,
      content: announcement.content,
      priority:
        announcement.priority.toLowerCase() as Lowercase<AnnouncementPriority>,
      status: this.computeEffectiveStatus(
        announcement,
        now,
      ).toLowerCase() as Lowercase<AnnouncementStatus>,
      postedBy: announcement.postedBy,
      postedAt: announcement.publishAt.toISOString(),
      expiresAt: announcement.expiresAt
        ? announcement.expiresAt.toISOString()
        : null,
      isRead,
      createdAt: announcement.createdAt.toISOString(),
      updatedAt: announcement.updatedAt.toISOString(),
    };
  }

  // Satellite offices see every published announcement, but a death
  // announcement's description/content is written for members — it may
  // explain the mutual aid wallet contribution that only applies to member
  // accounts. Satellites have no wallets and aren't charged anything, so
  // they get a neutral "a member has passed away" notice instead, never
  // the assessment/financial wording.
  private toSatelliteResponse(
    announcement: Announcement & {
      deceasedMember: {
        firstName: string;
        middleName: string | null;
        lastName: string;
      } | null;
    },
    now: Date,
  ): AnnouncementResponse {
    const response = this.toResponse(announcement, now, false);

    if (announcement.type !== AnnouncementType.DEATH) {
      return response;
    }

    const deceasedName = announcement.deceasedMember
      ? buildFullName(
          announcement.deceasedMember.firstName,
          announcement.deceasedMember.middleName,
          announcement.deceasedMember.lastName,
        )
      : null;

    const notice = deceasedName
      ? `We are saddened to share that ${deceasedName}, a member of the Legacy Care Bayanihan Community, has passed away. Our condolences to the family.`
      : 'We are saddened to share that a member of the Legacy Care Bayanihan Community has passed away. Our condolences to the family.';

    return {
      ...response,
      description: notice,
      content: notice,
    };
  }
}
