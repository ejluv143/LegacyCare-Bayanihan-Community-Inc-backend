import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/client';

import {
  GeneratedCodeCategory,
  GeneratedCodeStatus,
  MemberEarningStatus,
  MemberEarningType,
  MemberStatus,
  MembershipType,
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';
import type { PrismaService } from '../admin/database/prisma/prisma.service';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { WalletService } from './wallet.service';

const NOW = new Date('2026-08-06T04:30:00.000Z');

function decimal(value: number): Decimal {
  return new Decimal(value);
}

function memberRecord() {
  return {
    id: 'member-1',
    membershipId: 'LC-000001',
    firstName: ' Maria ',
    middleName: ' Dela ',
    lastName: ' Cruz ',
    membershipType: MembershipType.PREMIUM,
    status: MemberStatus.PENDING_ACTIVATION,
    beneficiaries: [
      {
        sequence: 2,
        firstName: 'Juan',
        middleName: null,
        lastName: 'Cruz',
      },
    ],
  };
}

function topUpCode(
  status: GeneratedCodeStatus = GeneratedCodeStatus.AVAILABLE,
) {
  return {
    id: 'code-1',
    code: '500-ABCDEFGH',
    category: GeneratedCodeCategory.TOP_UP,
    status,
    topUpAmount: 500,
    expiresAt: null,
    usedByMemberId: status === GeneratedCodeStatus.USED ? 'member-1' : null,
  };
}

describe('WalletService', () => {
  const memberFindUnique = jest.fn<(input: unknown) => Promise<unknown>>();
  const generatedCodeFindUnique =
    jest.fn<(input: unknown) => Promise<unknown>>();
  const generatedCodeUpdateMany =
    jest.fn<(input: unknown) => Promise<{ count: number }>>();
  const walletTransactionFindMany =
    jest.fn<(input: unknown) => Promise<unknown[]>>();
  const walletTransactionFindUnique =
    jest.fn<(input: unknown) => Promise<unknown>>();
  const walletTransactionCreate =
    jest.fn<(input: unknown) => Promise<unknown>>();
  const memberEarningFindMany =
    jest.fn<(input: unknown) => Promise<unknown[]>>();

  const transactionClient = {
    member: {
      findUnique: memberFindUnique,
    },
    generatedCode: {
      findUnique: generatedCodeFindUnique,
      updateMany: generatedCodeUpdateMany,
    },
    walletTransaction: {
      findMany: walletTransactionFindMany,
      findUnique: walletTransactionFindUnique,
      create: walletTransactionCreate,
    },
    memberEarning: {
      findMany: memberEarningFindMany,
    },
  };
  type TransactionOperation = (
    transaction: typeof transactionClient,
  ) => Promise<unknown>;
  const prismaTransaction =
    jest.fn<
      (operation: TransactionOperation, options?: unknown) => Promise<unknown>
    >();
  const prisma = {
    ...transactionClient,
    $transaction: prismaTransaction,
  };
  const service = new WalletService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    memberFindUnique.mockReset();
    generatedCodeFindUnique.mockReset();
    generatedCodeUpdateMany.mockReset();
    walletTransactionFindMany.mockReset();
    walletTransactionFindUnique.mockReset();
    walletTransactionCreate.mockReset();
    memberEarningFindMany.mockReset();
    prismaTransaction.mockReset();

    memberFindUnique.mockResolvedValue(memberRecord());
    walletTransactionFindMany.mockResolvedValue([]);
    walletTransactionFindUnique.mockResolvedValue(null);
    walletTransactionCreate.mockResolvedValue({ id: 'wallet-entry' });
    memberEarningFindMany.mockResolvedValue([]);
    generatedCodeUpdateMany.mockResolvedValue({ count: 1 });
    prismaTransaction.mockImplementation((operation) =>
      operation(transactionClient),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('combines funding and earnings without treating funding as lifetime earnings', async () => {
    walletTransactionFindMany.mockResolvedValue([
      {
        id: 'opening',
        type: WalletTransactionType.OPENING_CREDIT,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: decimal(200),
        sourceKey: 'opening-credit:member-1',
        description: 'Opening credit',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        id: 'top-up',
        type: WalletTransactionType.TOP_UP,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: decimal(500),
        sourceKey: 'top-up:code-1',
        description: null,
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
      },
      {
        id: 'withdrawal',
        type: WalletTransactionType.WITHDRAWAL,
        direction: WalletTransactionDirection.DEBIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: decimal(100),
        sourceKey: 'withdrawal:1',
        description: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      {
        id: 'pending-adjustment',
        type: WalletTransactionType.ADJUSTMENT,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.PENDING,
        amount: decimal(25),
        sourceKey: 'adjustment:1',
        description: null,
        createdAt: new Date('2026-08-04T00:00:00.000Z'),
      },
    ]);
    memberEarningFindMany.mockResolvedValue([
      {
        id: 'pairing',
        type: MemberEarningType.PAIRING_INCOME,
        status: MemberEarningStatus.COMPLETED,
        amount: decimal(300),
        earnedAt: new Date('2026-08-05T00:00:00.000Z'),
      },
      {
        id: 'referral',
        type: MemberEarningType.REFERRAL_COMMISSION,
        status: MemberEarningStatus.COMPLETED,
        amount: decimal(50),
        earnedAt: new Date('2026-08-05T01:00:00.000Z'),
      },
      {
        id: 'group',
        type: MemberEarningType.GROUP_COMMISSION,
        status: MemberEarningStatus.COMPLETED,
        amount: decimal(25),
        earnedAt: new Date('2026-08-05T02:00:00.000Z'),
      },
      {
        id: 'pending-group',
        type: MemberEarningType.GROUP_COMMISSION,
        status: MemberEarningStatus.PENDING,
        amount: decimal(10),
        earnedAt: new Date('2026-08-05T03:00:00.000Z'),
      },
    ]);

    const result = await service.getWallet('member-1');

    expect(result.member).toEqual({
      id: 'member-1',
      membershipId: 'LC-000001',
      fullName: 'Maria Dela Cruz',
      membershipType: 'premium',
      beneficiaries: ['Juan Cruz'],
    });
    expect(result.summary).toEqual({
      availableBalance: 975,
      pendingBalance: 35,
      lifetimeEarnings: 375,
      totalWithdrawn: 100,
      referralCommission: 50,
      groupCommission: 25,
    });
    expect(result.openingCreditAllocation).toEqual({
      totalAmount: 200,
      protectedLifeCount: 5,
      amountPerProtectedLife: 40,
      allocations: [
        {
          role: 'primary-member',
          slot: 0,
          status: 'assigned',
          name: 'Maria Dela Cruz',
          amount: 40,
        },
        {
          role: 'beneficiary',
          slot: 1,
          status: 'reserved',
          name: null,
          amount: 40,
        },
        {
          role: 'beneficiary',
          slot: 2,
          status: 'assigned',
          name: 'Juan Cruz',
          amount: 40,
        },
        {
          role: 'beneficiary',
          slot: 3,
          status: 'reserved',
          name: null,
          amount: 40,
        },
        {
          role: 'beneficiary',
          slot: 4,
          status: 'reserved',
          name: null,
          amount: 40,
        },
      ],
    });
    expect(result.pairingWindows).toEqual([]);
    expect(result.transactions.map(({ type }) => type)).toEqual([
      'group-commission',
      'group-commission',
      'referral-commission',
      'pairing-income',
      'adjustment',
      'withdrawal',
      'top-up',
      'opening-credit',
    ]);
  });

  it('maps reversed earnings to reversed status and excludes them from completed summary totals', async () => {
    walletTransactionFindMany.mockResolvedValue([
      {
        id: 'opening',
        type: WalletTransactionType.OPENING_CREDIT,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: decimal(200),
        sourceKey: 'opening-credit:member-1',
        description: 'Opening credit',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    memberEarningFindMany.mockResolvedValue([
      {
        id: 'reversed-earning',
        type: MemberEarningType.GROUP_COMMISSION,
        status: MemberEarningStatus.REVERSED,
        amount: decimal(-25),
        earnedAt: new Date('2026-08-05T02:00:00.000Z'),
      },
    ]);

    const result = await service.getWallet('member-1');

    expect(result.summary).toEqual({
      availableBalance: 200,
      pendingBalance: 0,
      lifetimeEarnings: 0,
      totalWithdrawn: 0,
      referralCommission: 0,
      groupCommission: 0,
    });
    expect(result.transactions).toContainEqual(
      expect.objectContaining({
        id: 'reversed-earning',
        type: 'group-commission',
        status: 'reversed',
        amount: 25,
      }),
    );
  });

  it.each([GeneratedCodeStatus.AVAILABLE, GeneratedCodeStatus.ASSIGNED])(
    'atomically redeems a %s bearer voucher',
    async (codeStatus) => {
      generatedCodeFindUnique.mockResolvedValue(topUpCode(codeStatus));
      walletTransactionFindMany.mockResolvedValue([
        {
          id: 'top-up-entry',
          type: WalletTransactionType.TOP_UP,
          direction: WalletTransactionDirection.CREDIT,
          status: WalletTransactionStatus.COMPLETED,
          amount: decimal(500),
          sourceKey: 'top-up:code-1',
          description: 'Top up',
          createdAt: NOW,
        },
      ]);

      const result = await service.redeemTopUp('member-1', {
        code: ' 500-abcdefgh ',
      });

      expect(generatedCodeUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'code-1',
            category: GeneratedCodeCategory.TOP_UP,
            status: {
              in: [GeneratedCodeStatus.AVAILABLE, GeneratedCodeStatus.ASSIGNED],
            },
            usedByMemberId: null,
            topUpAmount: 500,
          }),
          data: expect.objectContaining({
            status: GeneratedCodeStatus.USED,
            usedByMemberId: 'member-1',
            usedByMemberName: 'Maria Dela Cruz',
          }),
        }),
      );
      expect(walletTransactionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          memberId: 'member-1',
          type: WalletTransactionType.TOP_UP,
          direction: WalletTransactionDirection.CREDIT,
          status: WalletTransactionStatus.COMPLETED,
          sourceKey: 'top-up:code-1',
          generatedCodeId: 'code-1',
        }),
      });
      expect(result.creditedAmount).toBe(500);
      expect(result.wallet.summary.availableBalance).toBe(500);
      expect(result.wallet.openingCreditAllocation).toBeNull();
    },
  );

  it('returns the original credit for a same-member retry', async () => {
    generatedCodeFindUnique.mockResolvedValue(
      topUpCode(GeneratedCodeStatus.USED),
    );
    walletTransactionFindUnique.mockResolvedValue({
      memberId: 'member-1',
      type: WalletTransactionType.TOP_UP,
      direction: WalletTransactionDirection.CREDIT,
      status: WalletTransactionStatus.COMPLETED,
      amount: decimal(500),
    });

    const result = await service.redeemTopUp('member-1', {
      code: '500-ABCDEFGH',
    });

    expect(result.creditedAmount).toBe(500);
    expect(generatedCodeUpdateMany).not.toHaveBeenCalled();
    expect(walletTransactionCreate).not.toHaveBeenCalled();
  });

  it('rejects a voucher used by another member without writing money', async () => {
    generatedCodeFindUnique.mockResolvedValue({
      ...topUpCode(GeneratedCodeStatus.USED),
      usedByMemberId: 'other-member',
    });

    await expect(
      service.redeemTopUp('member-1', {
        code: '500-ABCDEFGH',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(generatedCodeUpdateMany).not.toHaveBeenCalled();
    expect(walletTransactionCreate).not.toHaveBeenCalled();
  });

  it('resolves a concurrent same-member conditional-claim loss idempotently', async () => {
    generatedCodeFindUnique
      .mockResolvedValueOnce(topUpCode())
      .mockResolvedValueOnce(topUpCode(GeneratedCodeStatus.USED));
    generatedCodeUpdateMany.mockResolvedValueOnce({ count: 0 });
    walletTransactionFindUnique.mockResolvedValue({
      memberId: 'member-1',
      type: WalletTransactionType.TOP_UP,
      direction: WalletTransactionDirection.CREDIT,
      status: WalletTransactionStatus.COMPLETED,
      amount: decimal(500),
    });

    const result = await service.redeemTopUp('member-1', {
      code: '500-ABCDEFGH',
    });

    expect(result.creditedAmount).toBe(500);
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
    expect(generatedCodeUpdateMany).toHaveBeenCalledTimes(1);
    expect(walletTransactionCreate).not.toHaveBeenCalled();
  });

  it.each([MemberStatus.SUSPENDED, MemberStatus.DISABLED])(
    'rejects a %s member before reading or claiming a top-up code',
    async (status) => {
      memberFindUnique.mockResolvedValue({
        ...memberRecord(),
        status,
      });

      await expect(
        service.redeemTopUp('member-1', {
          code: '500-ABCDEFGH',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(generatedCodeFindUnique).not.toHaveBeenCalled();
      expect(generatedCodeUpdateMany).not.toHaveBeenCalled();
      expect(walletTransactionCreate).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: 'wrong category',
      code: {
        ...topUpCode(),
        category: GeneratedCodeCategory.ACTIVATION,
      },
      exception: BadRequestException,
    },
    {
      label: 'expired status',
      code: topUpCode(GeneratedCodeStatus.EXPIRED),
      exception: ConflictException,
    },
    {
      label: 'disabled status',
      code: topUpCode(GeneratedCodeStatus.DISABLED),
      exception: ConflictException,
    },
    {
      label: 'missing amount',
      code: {
        ...topUpCode(),
        topUpAmount: null,
      },
      exception: ConflictException,
    },
    {
      label: 'zero amount',
      code: {
        ...topUpCode(),
        topUpAmount: 0,
      },
      exception: ConflictException,
    },
    {
      label: 'unsupported positive amount',
      code: {
        ...topUpCode(),
        topUpAmount: 750,
      },
      exception: ConflictException,
    },
  ])('rejects $label without a wallet write', async ({ code, exception }) => {
    generatedCodeFindUnique.mockResolvedValue(code);

    await expect(
      service.redeemTopUp('member-1', {
        code: code.code,
      }),
    ).rejects.toBeInstanceOf(exception);

    expect(generatedCodeUpdateMany).not.toHaveBeenCalled();
    expect(walletTransactionCreate).not.toHaveBeenCalled();
  });

  it('propagates a ledger write failure so Prisma rolls back the claimed code', async () => {
    generatedCodeFindUnique.mockResolvedValue(topUpCode());
    walletTransactionCreate.mockRejectedValue(new Error('ledger write failed'));

    await expect(
      service.redeemTopUp('member-1', {
        code: '500-ABCDEFGH',
      }),
    ).rejects.toThrow('ledger write failed');

    expect(generatedCodeUpdateMany).toHaveBeenCalledTimes(1);
    expect(walletTransactionCreate).toHaveBeenCalledTimes(1);
    expect(walletTransactionFindMany).not.toHaveBeenCalled();
  });
});
