import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client';
import type {
  MemberEarningType,
  MemberStatus,
  MembershipType,
  WalletTransactionDirection,
} from '../generated/prisma/enums';

import { PrismaService } from '../admin/database/prisma/prisma.service';
import { MembersService } from '../members/members.service';

import type { CreateGenealogyMemberDto } from './dto/create-genealogy-member.dto';

import type {
  GenealogyMemberDto,
  GenealogyResponseDto,
  TopPerformerDto,
  TopPerformersPeriod,
  TopPerformersResponseDto,
} from './member-dashboard.types';

export interface MemberDashboardStats {
  walletBalance: number;
  walletGrowthPercent: number;

  totalEarnings: number;
  earningsGrowthPercent: number;

  directReferrals: number;
  totalTeam: number;
  newDirectReferralsThisMonth: number;
  networkGrowthPercent: number;

  referralCommission: number;
  referralCommissionGrowthPercent: number;

  groupCommission: number;
  groupCommissionGrowthPercent: number;

  monthlyIncoming: number;
  monthlyWithdrawals: number;
}

export interface MemberDashboardStatsResponse {
  success: true;
  stats: MemberDashboardStats;
}

export interface MemberDashboardTotals {
  memberCount: number;
  beneficiaryCount: number;
  totalMembers: number;
}

export interface RecentVerifiedMemberDto {
  id: string;
  membershipId: string;
  fullName: string;
  membershipType: 'basic' | 'premium';
  avatarUrl: string | null;
  verifiedAt: string | null;
}

export interface RecentVerifiedMembersResponse {
  success: true;
  members: RecentVerifiedMemberDto[];
}

interface GenealogyMemberRecord {
  id: string;
  membershipId: string;

  firstName: string;
  middleName: string | null;
  lastName: string;

  username: string;

  membershipType: MembershipType;
  status: MemberStatus;

  referralCode: string;

  /*
   * Prisma schema field that identifies
   * the member's sponsor.
   */
  sponsorId: string | null;

  activatedAt: Date | null;
  createdAt: Date;

  _count?: {
    referredMembers: number;
  };
}

interface RecentVerifiedMemberRecord {
  id: string;
  membershipId: string;

  firstName: string;
  middleName: string | null;
  lastName: string;

  membershipType: MembershipType;

  profilePhoto: string | null;
  activatedAt: Date | null;
}

const DIRECT_LEFT_LIMIT = 3;
const RECENT_VERIFIED_MEMBERS_LIMIT = 5;
const TOP_PERFORMERS_LIMIT = 10;
const NETWORK_QUERY_BATCH_SIZE = 500;
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const TOP_PERFORMERS_PERIODS: TopPerformersPeriod[] = [
  'month',
  'year',
  'all-time',
];
const TOP_PERFORMER_EARNING_TYPES: MemberEarningType[] = [
  'PAIRING_INCOME',
  'REFERRAL_COMMISSION',
  'GROUP_COMMISSION',
];

interface TopPerformersPeriodRange {
  start: Date;
  end: Date;
}

interface ManilaMonthComparisonRange {
  previousStart: Date;
  currentStart: Date;
  nextStart: Date;
}

interface EarningRecord {
  type: MemberEarningType;
  amount: Prisma.Decimal;
  earnedAt: Date;
}

interface WalletFundingRecord {
  direction: WalletTransactionDirection;
  amount: Prisma.Decimal;
}

interface MemberEarningRecord {
  memberId: string;
  amount: Prisma.Decimal;
}

interface MemberEarningDelegate {
  findMany(args: {
    where: unknown;
    select: {
      type: true;
      amount: true;
      earnedAt: true;
    };
  }): Promise<EarningRecord[]>;

  findMany(args: {
    where: unknown;
    select: {
      memberId: true;
      amount: true;
    };
  }): Promise<MemberEarningRecord[]>;
}

interface MemberEarningClient {
  memberEarning: MemberEarningDelegate;
}

interface WalletTransactionDelegate {
  findMany(args: {
    where: unknown;
    select: {
      direction: true;
      amount: true;
    };
  }): Promise<WalletFundingRecord[]>;
}

interface WalletTransactionClient {
  walletTransaction: WalletTransactionDelegate;
}

interface EarningSummary {
  total: number;
  referralCommission: number;
  groupCommission: number;
}

interface NetworkMemberRecord {
  id: string;
  sponsorId: string | null;
  activatedAt: Date | null;
  createdAt: Date;
}

interface NetworkSummary {
  directReferrals: number;
  totalTeam: number;
  newDirectReferralsThisMonth: number;
  networkGrowthPercent: number;
}

const genealogyMemberSelect = {
  id: true,
  membershipId: true,

  firstName: true,
  middleName: true,
  lastName: true,

  username: true,

  membershipType: true,
  status: true,

  referralCode: true,
  sponsorId: true,

  activatedAt: true,
  createdAt: true,

  _count: {
    select: {
      referredMembers: true,
    },
  },
} as const;

const recentVerifiedMemberSelect = {
  id: true,
  membershipId: true,

  firstName: true,
  middleName: true,
  lastName: true,

  membershipType: true,

  profilePhoto: true,
  activatedAt: true,
} as const;

function createFullName(
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

function mapMemberStatus(status: MemberStatus): GenealogyMemberDto['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'active';

    case 'SUSPENDED':
      return 'suspended';

    case 'DISABLED':
      return 'inactive';

    case 'PENDING_ACTIVATION':
    default:
      return 'pending';
  }
}

function mapMembershipType(
  membershipType: MembershipType,
): GenealogyMemberDto['membershipType'] {
  switch (membershipType) {
    case 'PREMIUM':
      return 'premium';

    case 'BASIC':
    default:
      return 'basic';
  }
}

function mapRecentMembershipType(
  membershipType: MembershipType,
): RecentVerifiedMemberDto['membershipType'] {
  switch (membershipType) {
    case 'PREMIUM':
      return 'premium';

    case 'BASIC':
    default:
      return 'basic';
  }
}

function mapGenealogyMember(member: GenealogyMemberRecord): GenealogyMemberDto {
  return {
    id: member.id,
    membershipId: member.membershipId,

    firstName: member.firstName,
    middleName: member.middleName,
    lastName: member.lastName,

    fullName: createFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    ),

    username: member.username,

    membershipType: mapMembershipType(member.membershipType),

    status: mapMemberStatus(member.status),
    verified: member.status === 'ACTIVE',

    referralCode: member.referralCode,

    sponsorId: member.sponsorId,

    createdAt: member.createdAt.toISOString(),
    joinedAt: (member.activatedAt ?? member.createdAt).toISOString(),
    directReferrals: member._count?.referredMembers ?? 0,
  };
}

function mapRecentVerifiedMember(
  member: RecentVerifiedMemberRecord,
): RecentVerifiedMemberDto {
  return {
    id: member.id,
    membershipId: member.membershipId,

    fullName: createFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    ),

    membershipType: mapRecentMembershipType(member.membershipType),

    avatarUrl: member.profilePhoto,

    verifiedAt: member.activatedAt?.toISOString() ?? null,
  };
}

function getTopPerformersPeriodRange(
  period: TopPerformersPeriod,
  now: Date,
): TopPerformersPeriodRange | null {
  if (period === 'all-time') {
    return null;
  }

  const manilaDate = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const year = manilaDate.getUTCFullYear();
  const month = period === 'month' ? manilaDate.getUTCMonth() : 0;
  const endYear = period === 'year' ? year + 1 : year;
  const endMonth = period === 'month' ? month + 1 : 0;

  return {
    start: new Date(Date.UTC(year, month, 1) - MANILA_UTC_OFFSET_MS),
    end: new Date(Date.UTC(endYear, endMonth, 1) - MANILA_UTC_OFFSET_MS),
  };
}

function getManilaMonthComparisonRange(now: Date): ManilaMonthComparisonRange {
  const manilaDate = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const year = manilaDate.getUTCFullYear();
  const month = manilaDate.getUTCMonth();

  return {
    previousStart: new Date(
      Date.UTC(year, month - 1, 1) - MANILA_UTC_OFFSET_MS,
    ),
    currentStart: new Date(Date.UTC(year, month, 1) - MANILA_UTC_OFFSET_MS),
    nextStart: new Date(Date.UTC(year, month + 1, 1) - MANILA_UTC_OFFSET_MS),
  };
}

function summarizeEarnings(earnings: readonly EarningRecord[]): EarningSummary {
  let total = 0;
  let referralCommission = 0;
  let groupCommission = 0;

  for (const earning of earnings) {
    const amount = earning.amount.toNumber();

    total += amount;

    if (earning.type === 'REFERRAL_COMMISSION') {
      referralCommission += amount;
    }

    if (earning.type === 'GROUP_COMMISSION') {
      groupCommission += amount;
    }
  }

  return {
    total,
    referralCommission,
    groupCommission,
  };
}

function summarizeWalletFunding(
  transactions: readonly WalletFundingRecord[],
): number {
  return transactions.reduce((total, transaction) => {
    const amount = Math.abs(transaction.amount.toNumber());

    switch (transaction.direction) {
      case 'CREDIT':
        return total + amount;
      case 'DEBIT':
        return total - amount;
      case 'NEUTRAL':
      default:
        return total;
    }
  }, 0);
}

function calculateGrowthPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  const growth = ((current - previous) / Math.abs(previous)) * 100;
  const roundedGrowth = Math.round(growth * 100) / 100;

  return Object.is(roundedGrowth, -0) ? 0 : roundedGrowth;
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

function summarizeNetwork(
  memberId: string,
  members: readonly NetworkMemberRecord[],
  periodRange: ManilaMonthComparisonRange,
): NetworkSummary {
  const membersBySponsorId = new Map<string, NetworkMemberRecord[]>();

  for (const member of members) {
    if (!member.sponsorId) {
      continue;
    }

    const sponsoredMembers = membersBySponsorId.get(member.sponsorId) ?? [];
    sponsoredMembers.push(member);
    membersBySponsorId.set(member.sponsorId, sponsoredMembers);
  }

  const directMembers = membersBySponsorId.get(memberId) ?? [];
  const descendants: NetworkMemberRecord[] = [];
  const pendingMembers = [...directMembers];
  const visitedMemberIds = new Set<string>([memberId]);

  for (let index = 0; index < pendingMembers.length; index += 1) {
    const member = pendingMembers[index];

    if (visitedMemberIds.has(member.id)) {
      continue;
    }

    visitedMemberIds.add(member.id);
    descendants.push(member);
    pendingMembers.push(...(membersBySponsorId.get(member.id) ?? []));
  }

  const getJoinedAt = (member: NetworkMemberRecord): Date =>
    member.activatedAt ?? member.createdAt;

  const newDirectReferralsThisMonth = directMembers.filter((member) =>
    isWithinRange(
      getJoinedAt(member),
      periodRange.currentStart,
      periodRange.nextStart,
    ),
  ).length;

  const currentTeamAdditions = descendants.filter((member) =>
    isWithinRange(
      getJoinedAt(member),
      periodRange.currentStart,
      periodRange.nextStart,
    ),
  ).length;

  const previousTeamAdditions = descendants.filter((member) =>
    isWithinRange(
      getJoinedAt(member),
      periodRange.previousStart,
      periodRange.currentStart,
    ),
  ).length;

  return {
    directReferrals: directMembers.length,
    totalTeam: descendants.length,
    newDirectReferralsThisMonth,
    networkGrowthPercent: calculateGrowthPercent(
      currentTeamAdditions,
      previousTeamAdditions,
    ),
  };
}

function createCompletedEarningWhere(
  period: TopPerformersPeriod,
  now: Date,
): Prisma.MemberEarningWhereInput {
  const periodRange = getTopPerformersPeriodRange(period, now);

  return {
    status: 'COMPLETED',
    type: {
      in: TOP_PERFORMER_EARNING_TYPES,
    },
    member: {
      status: 'ACTIVE',
    },
    ...(periodRange
      ? {
          earnedAt: {
            gte: periodRange.start,
            lt: periodRange.end,
          },
        }
      : {}),
  };
}

@Injectable()
export class MemberDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  /**
   * Returns the authenticated member's dashboard
   * wallet and commission statistics.
   *
   * Completed earnings and completed wallet-funding ledger
   * entries together determine the available balance.
   */
  async getDashboardStats(
    memberId: string,
  ): Promise<MemberDashboardStatsResponse> {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member account was not found.');
    }

    const now = new Date();
    const periodRange = getManilaMonthComparisonRange(now);
    const completedEarningsWhere: Prisma.MemberEarningWhereInput = {
      memberId,
      status: 'COMPLETED',
      type: {
        in: TOP_PERFORMER_EARNING_TYPES,
      },
    };

    const [earnings, walletTransactions, networkMembers] = await Promise.all([
      this.memberEarnings.findMany({
        where: completedEarningsWhere,
        select: {
          type: true,
          amount: true,
          earnedAt: true,
        },
      }),
      this.walletTransactions.findMany({
        where: {
          memberId,
          status: 'COMPLETED',
        },
        select: {
          direction: true,
          amount: true,
        },
      }),
      this.loadNetworkMembers(memberId),
    ]);

    const lifetimeEarnings = summarizeEarnings(earnings);
    const walletFunding = summarizeWalletFunding(walletTransactions);
    const currentMonthEarnings = summarizeEarnings(
      earnings.filter((earning) =>
        isWithinRange(
          earning.earnedAt,
          periodRange.currentStart,
          periodRange.nextStart,
        ),
      ),
    );
    const previousMonthEarnings = summarizeEarnings(
      earnings.filter((earning) =>
        isWithinRange(
          earning.earnedAt,
          periodRange.previousStart,
          periodRange.currentStart,
        ),
      ),
    );
    const network = summarizeNetwork(memberId, networkMembers, periodRange);
    const earningsGrowthPercent = calculateGrowthPercent(
      currentMonthEarnings.total,
      previousMonthEarnings.total,
    );

    return {
      success: true,

      stats: {
        walletBalance: lifetimeEarnings.total + walletFunding,
        walletGrowthPercent: earningsGrowthPercent,

        totalEarnings: lifetimeEarnings.total,
        earningsGrowthPercent,

        directReferrals: network.directReferrals,
        totalTeam: network.totalTeam,
        newDirectReferralsThisMonth: network.newDirectReferralsThisMonth,
        networkGrowthPercent: network.networkGrowthPercent,

        referralCommission: lifetimeEarnings.referralCommission,
        referralCommissionGrowthPercent: calculateGrowthPercent(
          currentMonthEarnings.referralCommission,
          previousMonthEarnings.referralCommission,
        ),

        groupCommission: lifetimeEarnings.groupCommission,
        groupCommissionGrowthPercent: calculateGrowthPercent(
          currentMonthEarnings.groupCommission,
          previousMonthEarnings.groupCommission,
        ),

        monthlyIncoming: currentMonthEarnings.total,
        monthlyWithdrawals: 0,
      },
    };
  }

  async getMemberTotals(): Promise<MemberDashboardTotals> {
    const [memberCount, beneficiaryCount] = await this.prisma.$transaction([
      this.prisma.member.count(),
      this.prisma.beneficiary.count(),
    ]);

    return {
      memberCount,
      beneficiaryCount,

      totalMembers: memberCount + beneficiaryCount,
    };
  }

  async getRecentVerifiedMembers(): Promise<RecentVerifiedMembersResponse> {
    const recentMembers = await this.prisma.member.findMany({
      where: {
        status: 'ACTIVE',
        activatedAt: {
          not: null,
        },
      },
      orderBy: [
        {
          activatedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: RECENT_VERIFIED_MEMBERS_LIMIT,
      select: recentVerifiedMemberSelect,
    });

    return {
      success: true,
      members: recentMembers.map(mapRecentVerifiedMember),
    };
  }

  async getTopPerformers(
    requestedPeriod = 'month',
  ): Promise<TopPerformersResponseDto> {
    if (
      !TOP_PERFORMERS_PERIODS.includes(requestedPeriod as TopPerformersPeriod)
    ) {
      throw new BadRequestException(
        'period must be one of: month, year, all-time.',
      );
    }

    const period = requestedPeriod as TopPerformersPeriod;
    const now = new Date();

    const earnings: MemberEarningRecord[] = await this.memberEarnings.findMany({
      where: createCompletedEarningWhere(period, now),
      select: {
        memberId: true,
        amount: true,
      },
    });

    const totalEarningsByMemberId = new Map<string, number>();

    for (const earning of earnings) {
      const previousTotal = totalEarningsByMemberId.get(earning.memberId) ?? 0;
      totalEarningsByMemberId.set(
        earning.memberId,
        previousTotal + earning.amount.toNumber(),
      );
    }

    for (const [memberId, totalEarnings] of totalEarningsByMemberId) {
      if (totalEarnings <= 0) {
        totalEarningsByMemberId.delete(memberId);
      }
    }

    const members =
      totalEarningsByMemberId.size === 0
        ? []
        : await this.prisma.member.findMany({
            where: {
              id: {
                in: [...totalEarningsByMemberId.keys()],
              },
              status: 'ACTIVE',
            },
            select: {
              id: true,
              membershipId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              profilePhoto: true,
              membershipType: true,
              status: true,
            },
          });

    const rankedMembers = members
      .map((member) => ({
        member,
        totalEarnings: totalEarningsByMemberId.get(member.id) ?? 0,
      }))
      .filter(({ totalEarnings }) => totalEarnings > 0)
      .sort(
        (left, right) =>
          right.totalEarnings - left.totalEarnings ||
          left.member.membershipId.localeCompare(right.member.membershipId) ||
          left.member.id.localeCompare(right.member.id),
      );

    const performers: TopPerformerDto[] = rankedMembers
      .slice(0, TOP_PERFORMERS_LIMIT)
      .map(({ member, totalEarnings }, index) => ({
        id: member.id,
        membershipId: member.membershipId,
        fullName: createFullName(
          member.firstName,
          member.middleName,
          member.lastName,
        ),
        profilePhoto: member.profilePhoto,
        membershipType: mapMembershipType(member.membershipType),
        status: mapMemberStatus(member.status),
        rank: index + 1,
        totalEarnings,
        period,
      }));

    return {
      success: true,
      period,
      performers,
      totalMembers: rankedMembers.length,
      generatedAt: now.toISOString(),
    };
  }

  async createGenealogyMember(
    sponsorMemberId: string,
    dto: CreateGenealogyMemberDto,
  ) {
    const sponsor = await this.prisma.member.findUnique({
      where: {
        id: sponsorMemberId,
      },
      select: {
        id: true,
        membershipId: true,
        referralCode: true,
        status: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException('Sponsor member account was not found.');
    }

    if (sponsor.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Your account must be active before you can add a member.',
      );
    }

    /*
     * Count only the direct referrals of the
     * authenticated sponsor.
     */
    const directReferralCount = await this.prisma.member.count({
      where: {
        sponsorId: sponsor.id,
      },
    });

    /*
     * Legacy Care placement rule:
     *
     * Direct members 1–3 go to the LEFT.
     * Direct member 4 onward goes to the RIGHT.
     */
    const calculatedPlacement: 'LEFT' | 'RIGHT' =
      directReferralCount < DIRECT_LEFT_LIMIT ? 'LEFT' : 'RIGHT';

    const createdMember = await this.membersService.createMember({
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      address: dto.address,
      dateOfBirth: dto.dateOfBirth,
      email: dto.email,
      phone: dto.phone,
      username: dto.username,
      membershipType: dto.membershipType ?? 'BASIC',
      activationCode: dto.activationCode,
      /*
       * Automatically use the authenticated
       * sponsor's referral code.
       */
      sponsorReferralCode: sponsor.referralCode,
      password: dto.password,
      confirmPassword: dto.confirmPassword ?? dto.password,
    });

    return {
      success: true,
      message:
        calculatedPlacement === 'LEFT'
          ? 'Member successfully added to the left branch.'
          : 'Member successfully added to the right branch.',
      placement: calculatedPlacement,
      member: {
        ...createdMember,
        membershipType: mapMembershipType(createdMember.membershipType),
        status: mapMemberStatus(createdMember.status),
      },
    };
  }

  async getGenealogy(memberId: string): Promise<GenealogyResponseDto> {
    const rootMember = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },
      select: genealogyMemberSelect,
    });

    if (!rootMember) {
      throw new NotFoundException('Member account was not found.');
    }

    /*
     * Load the authenticated member's direct
     * referrals in creation order.
     *
     * The first three become the left branch.
     * All later direct referrals become the
     * right branch.
     */
    const directReferrals = await this.prisma.member.findMany({
      where: {
        sponsorId: rootMember.id,
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: genealogyMemberSelect,
    });

    const mappedRoot = mapGenealogyMember(rootMember);
    const mappedDirectReferrals = directReferrals.map(mapGenealogyMember);

    const leftMembers = mappedDirectReferrals.slice(0, DIRECT_LEFT_LIMIT);
    const rightMembers = mappedDirectReferrals.slice(DIRECT_LEFT_LIMIT);

    const visibleMembers = [mappedRoot, ...mappedDirectReferrals];

    const activeMembers = visibleMembers.filter(
      (member) => member.status === 'active',
    ).length;
    const pendingMembers = visibleMembers.filter(
      (member) => member.status === 'pending',
    ).length;
    const suspendedMembers = visibleMembers.filter(
      (member) => member.status === 'suspended',
    ).length;
    const inactiveMembers = visibleMembers.filter(
      (member) => member.status === 'inactive',
    ).length;
    const verifiedMembers = visibleMembers.filter(
      (member) => member.verified,
    ).length;

    const nextPlacement: GenealogyResponseDto['placementRules']['nextPlacement'] =
      mappedDirectReferrals.length < DIRECT_LEFT_LIMIT ? 'LEFT' : 'RIGHT';

    return {
      success: true,
      root: mappedRoot,
      branches: {
        left: leftMembers,
        right: rightMembers,
      },
      statistics: {
        totalMembers: visibleMembers.length,
        activeMembers,
        pendingMembers,
        suspendedMembers,
        inactiveMembers,
        verifiedMembers,
        leftMembers: leftMembers.length,
        rightMembers: rightMembers.length,
      },
      placementRules: {
        leftLimit: DIRECT_LEFT_LIMIT,
        leftCount: leftMembers.length,
        rightCount: rightMembers.length,
        remainingLeftSlots: Math.max(DIRECT_LEFT_LIMIT - leftMembers.length, 0),
        nextPlacement,
        leftDirectCount: leftMembers.length,
        rightUnlocked: leftMembers.length >= DIRECT_LEFT_LIMIT,
        canAddMember: mappedRoot.status === 'active',
      },
      sponsorReferralCode: rootMember.referralCode,
    };
  }

  private async loadNetworkMembers(
    rootMemberId: string,
  ): Promise<NetworkMemberRecord[]> {
    const networkMembers: NetworkMemberRecord[] = [];
    const visitedMemberIds = new Set<string>([rootMemberId]);
    let sponsorIds = [rootMemberId];

    while (sponsorIds.length > 0) {
      const sponsorIdBatches: string[][] = [];

      for (
        let index = 0;
        index < sponsorIds.length;
        index += NETWORK_QUERY_BATCH_SIZE
      ) {
        sponsorIdBatches.push(
          sponsorIds.slice(index, index + NETWORK_QUERY_BATCH_SIZE),
        );
      }

      const levelMembers = (
        await Promise.all(
          sponsorIdBatches.map((sponsorIdBatch) =>
            this.prisma.member.findMany({
              where: {
                sponsorId: {
                  in: sponsorIdBatch,
                },
              },
              select: {
                id: true,
                sponsorId: true,
                activatedAt: true,
                createdAt: true,
              },
            }),
          ),
        )
      ).flat();

      const currentSponsorIds = new Set(sponsorIds);
      const nextSponsorIds: string[] = [];

      for (const member of levelMembers) {
        if (
          !member.sponsorId ||
          !currentSponsorIds.has(member.sponsorId) ||
          visitedMemberIds.has(member.id)
        ) {
          continue;
        }

        visitedMemberIds.add(member.id);
        networkMembers.push(member);
        nextSponsorIds.push(member.id);
      }

      sponsorIds = nextSponsorIds;
    }

    return networkMembers;
  }

  /**
   * Prisma's generated group and find-many delegate can be reported as an
   * unresolved error type by type-aware editor linting. Keep that generated
   * boundary here and expose only the two result shapes this service uses.
   */
  private get memberEarnings(): MemberEarningDelegate {
    return (this.prisma as unknown as MemberEarningClient).memberEarning;
  }

  private get walletTransactions(): WalletTransactionDelegate {
    return (this.prisma as unknown as WalletTransactionClient)
      .walletTransaction;
  }
}
