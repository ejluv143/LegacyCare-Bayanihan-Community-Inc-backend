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
} from './wallet-opening-credit';

describe('createMemberOpeningCredit', () => {
  it('posts one completed PHP 200 funding credit with a member-scoped key', async () => {
    const create = jest.fn<(input: unknown) => Promise<unknown>>();
    create.mockResolvedValue({ id: 'wallet-entry' });
    const transaction = {
      walletTransaction: {
        create,
      },
    } as unknown as Prisma.TransactionClient;

    await createMemberOpeningCredit(transaction, 'member-1');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        memberId: 'member-1',
        type: WalletTransactionType.OPENING_CREDIT,
        direction: WalletTransactionDirection.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
        amount: expect.anything(),
        sourceKey: 'opening-credit:member-1',
        description: 'One-time new member opening credit.',
      },
    });

    const call = create.mock.calls[0][0] as {
      data: {
        amount: Decimal;
      };
    };
    expect(call.data.amount.toNumber()).toBe(MEMBER_OPENING_CREDIT_AMOUNT);
  });
});
