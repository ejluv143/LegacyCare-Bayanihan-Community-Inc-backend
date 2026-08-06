import { BadRequestException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { MemberStatus, MembershipType } from '../generated/prisma/enums';

import type { PrismaService } from '../admin/database/prisma/prisma.service';
import type { MembersService } from '../members/members.service';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../members/members.service', () => ({
  MembersService: class MembersService {},
}));

import { MemberDashboardService } from './member-dashboard.service';

interface RankedMemberRecord {
  id: string;
  membershipId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profilePhoto: string | null;
  membershipType: MembershipType;
  status: MemberStatus;
  _count: {
    referredMembers: number;
  };
}

const NOW = new Date('2026-08-06T04:30:00.000Z');

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
    _count: {
      referredMembers: 1,
    },
    ...overrides,
  };
}

describe('MemberDashboardService top performers', () => {
  const findMany = jest.fn<(input: unknown) => Promise<RankedMemberRecord[]>>();

  const prisma = {
    member: {
      findMany,
    },
  };

  const service = new MemberDashboardService(
    prisma as unknown as PrismaService,
    {} as MembersService,
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    findMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the current Manila month and activation time by default', async () => {
    findMany.mockResolvedValue([
      createRankedMember({
        _count: {
          referredMembers: 3,
        },
      }),
    ]);

    const result = await service.getTopPerformers();

    const monthStart = new Date('2026-07-31T16:00:00.000Z');
    const monthEnd = new Date('2026-08-31T16:00:00.000Z');
    const activeReferralWhere = {
      status: MemberStatus.ACTIVE,
      OR: [
        {
          activatedAt: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        {
          activatedAt: null,
          createdAt: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
      ],
    };

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: MemberStatus.ACTIVE,
        referredMembers: {
          some: activeReferralWhere,
        },
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
        _count: {
          select: {
            referredMembers: {
              where: activeReferralWhere,
            },
          },
        },
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
          totalReferrals: 3,
          period: 'month',
        },
      ],
      totalMembers: 1,
      generatedAt: NOW.toISOString(),
    });
  });

  it('uses the current Manila calendar year', async () => {
    findMany.mockResolvedValue([]);

    await service.getTopPerformers('year');

    const yearStart = new Date('2025-12-31T16:00:00.000Z');
    const yearEnd = new Date('2026-12-31T16:00:00.000Z');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MemberStatus.ACTIVE,
          referredMembers: {
            some: {
              status: MemberStatus.ACTIVE,
              OR: [
                {
                  activatedAt: {
                    gte: yearStart,
                    lt: yearEnd,
                  },
                },
                {
                  activatedAt: null,
                  createdAt: {
                    gte: yearStart,
                    lt: yearEnd,
                  },
                },
              ],
            },
          },
        },
      }),
    );
  });

  it('does not apply a date range to all-time rankings', async () => {
    findMany.mockResolvedValue([]);

    const result = await service.getTopPerformers('all-time');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MemberStatus.ACTIVE,
          referredMembers: {
            some: {
              status: MemberStatus.ACTIVE,
            },
          },
        },
      }),
    );
    expect(result.performers).toEqual([]);
    expect(result.totalMembers).toBe(0);
  });

  it('sorts deterministically, excludes zero counts, and returns only ten', async () => {
    const rankedMembers = Array.from({ length: 12 }, (_, index) =>
      createRankedMember({
        id: `member-${index + 1}`,
        membershipId: `LC-${String(index + 1).padStart(6, '0')}`,
        firstName: `Member${index + 1}`,
        lastName: 'Test',
        _count: {
          referredMembers: 12 - index,
        },
      }),
    );

    rankedMembers.push(
      createRankedMember({
        id: 'member-zero',
        membershipId: 'LC-999999',
        _count: {
          referredMembers: 0,
        },
      }),
    );
    rankedMembers[0] = createRankedMember({
      id: 'member-b',
      membershipId: 'LC-000002',
      _count: {
        referredMembers: 12,
      },
    });
    rankedMembers[1] = createRankedMember({
      id: 'member-a',
      membershipId: 'LC-000001',
      _count: {
        referredMembers: 12,
      },
    });
    findMany.mockResolvedValue(rankedMembers);

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

    expect(findMany).not.toHaveBeenCalled();
  });
});
