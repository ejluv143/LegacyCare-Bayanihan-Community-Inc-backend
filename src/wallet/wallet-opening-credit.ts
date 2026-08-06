import { Decimal } from '@prisma/client/runtime/client';
import type { Prisma } from '../generated/prisma/client';
import {
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';

export const MEMBER_OPENING_CREDIT_AMOUNT = 200;

export function createMemberOpeningCredit(
  transaction: Prisma.TransactionClient,
  memberId: string,
) {
  return transaction.walletTransaction.create({
    data: {
      memberId,
      type: WalletTransactionType.OPENING_CREDIT,
      direction: WalletTransactionDirection.CREDIT,
      status: WalletTransactionStatus.COMPLETED,
      amount: new Decimal(MEMBER_OPENING_CREDIT_AMOUNT),
      sourceKey: `opening-credit:${memberId}`,
      description: 'One-time new member opening credit.',
    },
  });
}
