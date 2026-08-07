import { Decimal } from '@prisma/client/runtime/client';
import type { Prisma } from '../generated/prisma/client';
import {
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';
import { MAXIMUM_BENEFICIARIES } from '../beneficiary/beneficiary.constants';

export const MEMBER_OPENING_CREDIT_AMOUNT = 200 as const;
export const MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT: number =
  MAXIMUM_BENEFICIARIES + 1;
export const MEMBER_OPENING_CREDIT_SHARE_AMOUNT: number =
  MEMBER_OPENING_CREDIT_AMOUNT / MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT;

export function createMemberOpeningCredit(
  transaction: Prisma.TransactionClient,
  memberId: string,
) {
  const sourceKey = `opening-credit:${memberId}`;

  return transaction.walletTransaction.upsert({
    where: {
      sourceKey,
    },
    create: {
      memberId,
      type: WalletTransactionType.OPENING_CREDIT,
      direction: WalletTransactionDirection.CREDIT,
      status: WalletTransactionStatus.COMPLETED,
      amount: new Decimal(MEMBER_OPENING_CREDIT_AMOUNT),
      sourceKey,
      description: 'One-time new member opening credit.',
    },
    update: {},
  });
}
