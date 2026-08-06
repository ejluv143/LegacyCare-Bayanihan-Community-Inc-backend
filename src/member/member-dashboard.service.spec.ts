import { BadRequestException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  MemberEarningStatus,
  MemberEarningType,
  MemberStatus,
  MembershipType,
} from '../generated/prisma/enums';

import type { PrismaService } from '../admin/database/prisma/prisma.service';
import type { MembersService } from '../members/members.service';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../members/members.service', () => ({
  MembersService: class MembersService {},
}));

import { MemberDashboardService } from './member-dashboard.service';

interface DecimalLike {
  toNumber(): number;
}

interface EarningRecord {
  memberId: string;
  amount: DecimalLike;
}

interface RankedMemberRecord {
  id: string;
  membershipId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profilePhoto: string | null;
  membershipType: MembershipType;
  status: MemberStatus;
}

const NOW = new Date('2026-08-06T04:30:00.000Z');
const EARNING_TYPES = [
  MemberEarningType.PAIRING_INCOME,
  MemberEarningType.REFERRAL_COMMISSION,
  MemberEarningType.GROUP_COMMISSION,
];

function decimal(value: number): DecimalLike {
  return {
    toNumber: () => value,
  };
}

function createEarning(memberId: string, totalEarnings: number): EarningRecord {
  return {
    memberId,
    amount: decimal(totalEarnings),
  };
}

function createRankedMember(
  overrides: Partial<RankedMemberRecord> = {},
): RankedMemberRecord {
  return {
    id: 'member-1',
    membershipId: 'LC-000001',
    firstName: 'Maria',
    middleName: null,
    lastName: 'Santos',
    profilePhoto: null,
    membershipType: MembershipType.BASIC,
    status: MemberStatus.ACTIVE,
    ...overrides,
  };
}

describe('MemberDashboardService top performers', () => {
  const earningFindMany =
    jest.fn<(input: unknown) => Promise<EarningRecord[]>>();
  const memberFindMany =
    jest.fn<(input: unknown) => Promise<RankedMemberRecord[]>>();

  const prisma = {
    memberEarning: {
      findMany: earningFindMany,
    },
    member: {
      findMany: memberFindMany,
    },
  };

  const service = new MemberDashboardService(
    prisma as unknown as PrismaService,
    {} as MembersService,
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    earningFindMany.mockReset();
    memberFindMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sums completed earnings in the current Manila month by default', async () => {
    earningFindMany.mockResolvedValue([createEarning('member-1', 18400.5)]);
    memberFindMany.mockResolvedValue([createRankedMember()]);

    const result = await service.getTopPerformers();

    const monthStart = new Date('2026-07-31T16:00:00.000Z');
    const monthEnd = new Date('2026-08-31T16:00:00.000Z');

    expect(earningFindMany).toHaveBeenCalledWith({
      where: {
        status: MemberEarningStatus.COMPLETED,
        type: {
          in: EARNING_TYPES,
        },
        member: {
          status: MemberStatus.ACTIVE,
        },
        earnedAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        memberId: true,
        amount: true,
      },
    });

    expect(memberFindMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['member-1'],
        },
        status: MemberStatus.ACTIVE,
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

    expect(result).toEqual({
      success: true,
      period: 'month',
      performers: [
        {
          id: 'member-1',
          membershipId: 'LC-000001',
          fullName: 'Maria Santos',
          profilePhoto: null,
          membershipType: 'basic',
          status: 'active',
          rank: 1,
          totalEarnings: 18400.5,
          period: 'month',
        },
      ],
      totalMembers: 1,
      generatedAt: NOW.toISOString(),
    });
  });

  it('uses the current Manila calendar year', async () => {
    earningFindMany.mockResolvedValue([]);

    await service.getTopPerformers('year');

    const yearStart = new Date('2025-12-31T16:00:00.000Z');
    const yearEnd = new Date('2026-12-31T16:00:00.000Z');

    expect(earningFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          earnedAt: {
            gte: yearStart,
            lt: yearEnd,
          },
        }),
      }),
    );
    expect(memberFindMany).not.toHaveBeenCalled();
  });

  it('does not apply a date range to all-time earnings', async () => {
    earningFindMany.mockResolvedValue([]);

    const result = await service.getTopPerformers('all-time');

    expect(earningFindMany).toHaveBeenCalledWith({
      where: {
        status: MemberEarningStatus.COMPLETED,
        type: {
          in: EARNING_TYPES,
        },
        member: {
          status: MemberStatus.ACTIVE,
        },
      },
      select: {
        memberId: true,
        amount: true,
      },
    });
    expect(result.performers).toEqual([]);
    expect(result.totalMembers).toBe(0);
    expect(memberFindMany).not.toHaveBeenCalled();
  });

  it('sorts by money, breaks ties deterministically, and returns only ten', async () => {
    const earningGroups = Array.from({ length: 12 }, (_, index) =>
      createEarning(`member-${index + 1}`, 12000 - index * 500),
    );
    earningGroups[0] = createEarning('member-b', 12000);
    earningGroups[1] = createEarning('member-a', 12000);
    earningGroups.push(createEarning('member-zero', 0));

    const members = earningGroups
      .filter((group) => group.memberId !== 'member-zero')
      .map((group, index) =>
        createRankedMember({
          id: group.memberId,
          membershipId:
            group.memberId === 'member-a'
              ? 'LC-000001'
              : group.memberId === 'member-b'
                ? 'LC-000002'
                : `LC-${String(index + 10).padStart(6, '0')}`,
          firstName: `Member${index + 1}`,
          lastName: 'Test',
        }),
      );

    earningFindMany.mockResolvedValue(earningGroups);
    memberFindMany.mockResolvedValue(members.reverse());

    const result = await service.getTopPerformers('all-time');

    expect(result.totalMembers).toBe(12);
    expect(result.performers).toHaveLength(10);
    expect(result.performers.slice(0, 2).map(({ id }) => id)).toEqual([
      'member-a',
      'member-b',
    ]);
    expect(result.performers.map(({ rank }) => rank)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
  });

  it('rejects an unsupported period before querying the database', async () => {
    await expect(service.getTopPerformers('week')).rejects.toThrow(
      BadRequestException,
    );

    expect(earningFindMany).not.toHaveBeenCalled();
    expect(memberFindMany).not.toHaveBeenCalled();
  });
});
