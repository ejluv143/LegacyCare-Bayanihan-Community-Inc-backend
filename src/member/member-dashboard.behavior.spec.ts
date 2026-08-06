import { NotFoundException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { PrismaService } from '../admin/database/prisma/prisma.service';
import type { MembersService } from '../members/members.service';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../members/members.service', () => ({
  MembersService: class MembersService {},
}));

import type { CreateGenealogyMemberDto } from './dto/create-genealogy-member.dto';
import { MemberDashboardService } from './member-dashboard.service';

interface DecimalLike {
  toNumber(): number;
}

type EarningType =
  'PAIRING_INCOME' | 'REFERRAL_COMMISSION' | 'GROUP_COMMISSION';

type TestMembershipType = 'BASIC' | 'PREMIUM';

type TestMemberStatus =
  'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

interface EarningRecord {
  type: EarningType;
  amount: DecimalLike;
  earnedAt: Date;
}

interface GenealogyMemberRecord {
  id: string;
  membershipId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  username: string;
  membershipType: TestMembershipType;
  status: TestMemberStatus;
  referralCode: string;
  sponsorId: string | null;
  activatedAt: Date | null;
  createdAt: Date;
  _count?: {
    referredMembers: number;
  };
}

const NOW = new Date('2026-08-06T04:30:00.000Z');
const EARNING_TYPES: EarningType[] = [
  'PAIRING_INCOME',
  'REFERRAL_COMMISSION',
  'GROUP_COMMISSION',
];

function decimal(value: number): DecimalLike {
  return {
    toNumber: () => value,
  };
}

function earning(
  type: EarningType,
  amount: number,
  earnedAt: string,
): EarningRecord {
  return {
    type,
    amount: decimal(amount),
    earnedAt: new Date(earnedAt),
  };
}

function genealogyMember(
  overrides: Partial<GenealogyMemberRecord> = {},
): GenealogyMemberRecord {
  return {
    id: 'root-member',
    membershipId: 'LC-ROOT',
    firstName: 'Root',
    middleName: null,
    lastName: 'Member',
    username: 'root.member',
    membershipType: 'BASIC',
    status: 'ACTIVE',
    referralCode: 'LC-ROOT-CODE',
    sponsorId: null,
    activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MemberDashboardService dashboard compatibility behavior', () => {
  const memberFindUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const memberFindMany = jest.fn<(input: unknown) => Promise<unknown[]>>();
  const memberCount = jest.fn<(input: unknown) => Promise<number>>();
  const earningFindMany = jest.fn<(input: unknown) => Promise<unknown[]>>();
  const walletTransactionFindMany =
    jest.fn<(input: unknown) => Promise<unknown[]>>();
  const createMember =
    jest.fn<(input: unknown) => Promise<Record<string, unknown>>>();

  const prisma = {
    member: {
      findUnique: memberFindUnique,
      findMany: memberFindMany,
      count: memberCount,
    },
    memberEarning: {
      findMany: earningFindMany,
    },
    walletTransaction: {
      findMany: walletTransactionFindMany,
    },
  };

  const membersService = {
    createMember,
  };

  const service = new MemberDashboardService(
    prisma as unknown as PrismaService,
    membersService as unknown as MembersService,
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    memberFindUnique.mockReset();
    memberFindMany.mockReset();
    memberCount.mockReset();
    earningFindMany.mockReset();
    walletTransactionFindMany.mockReset();
    createMember.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aggregates completed earnings and network growth using Manila month boundaries', async () => {
    memberFindUnique.mockResolvedValue({ id: 'root-member' });
    earningFindMany.mockResolvedValue([
      earning('PAIRING_INCOME', 300, '2026-08-02T00:00:00.000Z'),
      earning('REFERRAL_COMMISSION', 100, '2026-08-03T00:00:00.000Z'),
      earning('GROUP_COMMISSION', 50, '2026-08-04T00:00:00.000Z'),
      earning('PAIRING_INCOME', 100, '2026-07-02T00:00:00.000Z'),
      earning('REFERRAL_COMMISSION', 50, '2026-07-03T00:00:00.000Z'),
      earning('GROUP_COMMISSION', 100, '2026-07-04T00:00:00.000Z'),
      earning('PAIRING_INCOME', 600, '2026-06-02T00:00:00.000Z'),
      earning('REFERRAL_COMMISSION', 150, '2026-06-03T00:00:00.000Z'),
      earning('GROUP_COMMISSION', 50, '2026-06-04T00:00:00.000Z'),
    ]);
    walletTransactionFindMany.mockResolvedValue([
      {
        direction: 'CREDIT',
        amount: decimal(700),
      },
      {
        direction: 'DEBIT',
        amount: decimal(100),
      },
      {
        direction: 'NEUTRAL',
        amount: decimal(999),
      },
    ]);
    const directMembers = [
      {
        id: 'direct-current',
        sponsorId: 'root-member',
        activatedAt: new Date('2026-08-02T00:00:00.000Z'),
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        id: 'direct-previous',
        sponsorId: 'root-member',
        activatedAt: new Date('2026-07-15T00:00:00.000Z'),
        createdAt: new Date('2026-07-14T00:00:00.000Z'),
      },
    ];
    const childMembers = [
      {
        id: 'child-current',
        sponsorId: 'direct-previous',
        activatedAt: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      {
        id: 'child-old',
        sponsorId: 'direct-previous',
        activatedAt: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-05-31T00:00:00.000Z'),
      },
    ];
    memberFindMany
      .mockResolvedValueOnce(directMembers)
      .mockResolvedValueOnce(childMembers)
      .mockResolvedValueOnce([]);

    const result = await service.getDashboardStats('root-member');

    const completedEarningsWhere = {
      memberId: 'root-member',
      status: 'COMPLETED',
      type: {
        in: EARNING_TYPES,
      },
    };

    expect(earningFindMany).toHaveBeenCalledWith({
      where: completedEarningsWhere,
      select: {
        type: true,
        amount: true,
        earnedAt: true,
      },
    });
    expect(walletTransactionFindMany).toHaveBeenCalledWith({
      where: {
        memberId: 'root-member',
        status: 'COMPLETED',
      },
      select: {
        direction: true,
        amount: true,
      },
    });
    const networkMemberSelect = {
      id: true,
      sponsorId: true,
      activatedAt: true,
      createdAt: true,
    };
    expect(memberFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        sponsorId: {
          in: ['root-member'],
        },
      },
      select: networkMemberSelect,
    });
    expect(memberFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        sponsorId: {
          in: ['direct-current', 'direct-previous'],
        },
      },
      select: networkMemberSelect,
    });
    expect(memberFindMany).toHaveBeenNthCalledWith(3, {
      where: {
        sponsorId: {
          in: ['child-current', 'child-old'],
        },
      },
      select: networkMemberSelect,
    });
    expect(memberFindMany).toHaveBeenCalledTimes(3);

    expect(result).toEqual({
      success: true,
      stats: {
        walletBalance: 2100,
        walletGrowthPercent: 80,
        totalEarnings: 1500,
        earningsGrowthPercent: 80,
        directReferrals: 2,
        totalTeam: 4,
        newDirectReferralsThisMonth: 1,
        networkGrowthPercent: 100,
        referralCommission: 300,
        referralCommissionGrowthPercent: 100,
        groupCommission: 200,
        groupCommissionGrowthPercent: -50,
        monthlyIncoming: 450,
        monthlyWithdrawals: 0,
      },
    });
  });

  it('throws for a missing member before running aggregate queries', async () => {
    memberFindUnique.mockResolvedValue(null);

    await expect(
      service.getDashboardStats('missing-member'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(earningFindMany).not.toHaveBeenCalled();
    expect(walletTransactionFindMany).not.toHaveBeenCalled();
    expect(memberFindMany).not.toHaveBeenCalled();
  });

  it('filters recent verified members and maps profilePhoto to avatarUrl', async () => {
    memberFindMany.mockResolvedValue([
      {
        id: 'verified-member',
        membershipId: 'LC-VERIFIED',
        firstName: ' Ana ',
        middleName: ' Dela ',
        lastName: ' Cruz ',
        membershipType: 'PREMIUM',
        profilePhoto: 'https://example.test/avatar.jpg',
        activatedAt: new Date('2026-08-05T08:00:00.000Z'),
      },
    ]);

    const result = await service.getRecentVerifiedMembers();

    expect(memberFindMany).toHaveBeenCalledWith({
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
      take: 5,
      select: {
        id: true,
        membershipId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        membershipType: true,
        profilePhoto: true,
        activatedAt: true,
      },
    });
    expect(result).toEqual({
      success: true,
      members: [
        {
          id: 'verified-member',
          membershipId: 'LC-VERIFIED',
          fullName: 'Ana Dela Cruz',
          membershipType: 'premium',
          avatarUrl: 'https://example.test/avatar.jpg',
          verifiedAt: '2026-08-05T08:00:00.000Z',
        },
      ],
    });
  });

  it('uses the password as confirmation and returns frontend genealogy enums', async () => {
    memberFindUnique.mockResolvedValue({
      id: 'root-member',
      membershipId: 'LC-ROOT',
      referralCode: 'LC-SPONSOR-CODE',
      status: 'ACTIVE',
    });
    memberCount.mockResolvedValue(3);
    createMember.mockResolvedValue({
      id: 'created-member',
      membershipId: 'LC-CREATED',
      membershipType: 'PREMIUM',
      status: 'SUSPENDED',
    });

    const dto: CreateGenealogyMemberDto = {
      firstName: 'New',
      middleName: 'Genealogy',
      lastName: 'Member',
      address: '123 Example Street',
      dateOfBirth: '1990-01-01',
      email: 'new.member@example.test',
      phone: '+639171234567',
      username: 'new.member',
      membershipType: 'PREMIUM',
      activationCode: 'ACT-123456',
      password: 'correct-horse-battery-staple',
      referralCode: 'IGNORED-CODE',
      sponsorId: 'ignored-sponsor',
      placement: 'LEFT',
    };

    const result = await service.createGenealogyMember('root-member', dto);

    expect(memberCount).toHaveBeenCalledWith({
      where: {
        sponsorId: 'root-member',
      },
    });
    expect(createMember).toHaveBeenCalledWith({
      firstName: 'New',
      middleName: 'Genealogy',
      lastName: 'Member',
      address: '123 Example Street',
      dateOfBirth: '1990-01-01',
      email: 'new.member@example.test',
      phone: '+639171234567',
      username: 'new.member',
      membershipType: 'PREMIUM',
      activationCode: 'ACT-123456',
      sponsorReferralCode: 'LC-SPONSOR-CODE',
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    });
    expect(result).toEqual({
      success: true,
      message: 'Member successfully added to the right branch.',
      placement: 'RIGHT',
      member: {
        id: 'created-member',
        membershipId: 'LC-CREATED',
        membershipType: 'premium',
        status: 'suspended',
      },
    });
  });

  it('returns compatibility genealogy statistics and placement fields', async () => {
    const root = genealogyMember({
      _count: {
        referredMembers: 4,
      },
    });
    const directReferrals = [
      genealogyMember({
        id: 'direct-1',
        membershipId: 'LC-001',
        status: 'ACTIVE',
        sponsorId: root.id,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        _count: {
          referredMembers: 2,
        },
      }),
      genealogyMember({
        id: 'direct-2',
        membershipId: 'LC-002',
        status: 'PENDING_ACTIVATION',
        sponsorId: root.id,
        activatedAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
      genealogyMember({
        id: 'direct-3',
        membershipId: 'LC-003',
        status: 'SUSPENDED',
        sponsorId: root.id,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      }),
      genealogyMember({
        id: 'direct-4',
        membershipId: 'LC-004',
        status: 'DISABLED',
        sponsorId: root.id,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ];
    memberFindUnique.mockResolvedValue(root);
    memberFindMany.mockResolvedValue(directReferrals);

    const result = await service.getGenealogy(root.id);

    expect(result.statistics).toEqual({
      totalMembers: 5,
      activeMembers: 2,
      pendingMembers: 1,
      suspendedMembers: 1,
      inactiveMembers: 1,
      verifiedMembers: 2,
      leftMembers: 3,
      rightMembers: 1,
    });
    expect(result.placementRules).toEqual({
      leftLimit: 3,
      leftCount: 3,
      rightCount: 1,
      remainingLeftSlots: 0,
      nextPlacement: 'RIGHT',
      leftDirectCount: 3,
      rightUnlocked: true,
      canAddMember: true,
    });
    expect(result.branches.left.map(({ id }) => id)).toEqual([
      'direct-1',
      'direct-2',
      'direct-3',
    ]);
    expect(result.branches.right.map(({ id }) => id)).toEqual(['direct-4']);
    expect(result.root.directReferrals).toBe(4);
    expect(result.branches.left[0].directReferrals).toBe(2);
    expect(result.branches.left[1].directReferrals).toBe(0);
    expect(result.sponsorReferralCode).toBe('LC-ROOT-CODE');
  });
});
