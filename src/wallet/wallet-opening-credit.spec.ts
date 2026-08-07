import { describe, expect, it, jest } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/client';

import type { Prisma } from '../generated/prisma/client';
import {
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';
import {
  createMemberOpeningCredit,
  MEMBER_OPENING_CREDIT_AMOUNT,
  MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT,
  MEMBER_OPENING_CREDIT_SHARE_AMOUNT,
} from './wallet-opening-credit';

describe('createMemberOpeningCredit', () => {
  it('posts one completed PHP 200 funding credit with a member-scoped key', async () => {
    const upsert = jest.fn<(input: unknown) => Promise<unknown>>();
    upsert.mockResolvedValue({ id: 'wallet-entry' });
    const transaction = {
      walletTransaction: {
        upsert,
      },
    } as unknown as Prisma.TransactionClient;

    await createMemberOpeningCredit(transaction, 'member-1');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: {
        sourceKey: 'opening-credit:member-1',
      },
      create: {
        memberId: 'member-1',
        type: WalletTransactionType.OPENING_CREDIT,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: expect.anything(),
        sourceKey: 'opening-credit:member-1',
        description: 'One-time new member opening credit.',
      },
      update: {},
    });

    const call = upsert.mock.calls[0][0] as {
      create: {
        amount: Decimal;
      };
    };
    expect(call.create.amount.toNumber()).toBe(MEMBER_OPENING_CREDIT_AMOUNT);
  });

  it('allocates the opening credit across one member and four beneficiaries', () => {
    expect(MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT).toBe(5);
    expect(MEMBER_OPENING_CREDIT_SHARE_AMOUNT).toBe(40);
    expect(
      MEMBER_OPENING_CREDIT_SHARE_AMOUNT *
        MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT,
    ).toBe(MEMBER_OPENING_CREDIT_AMOUNT);
  });
});
