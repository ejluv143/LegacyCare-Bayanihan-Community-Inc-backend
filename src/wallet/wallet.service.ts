import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  Decimal,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/client';

import type { Prisma } from '../generated/prisma/client';

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

import { PrismaService } from '../admin/database/prisma/prisma.service';

import { MAXIMUM_BENEFICIARIES } from '../beneficiary/beneficiary.constants';

import { RedeemTopUpDto } from './dto/redeem-top-up.dto';

import type {
  RedeemTopUpResponseDto,
  WalletApiTransactionDirection,
  WalletApiTransactionStatus,
  WalletApiTransactionType,
  WalletMembershipType,
  WalletOpeningCreditAllocationDto,
  WalletOpeningCreditAllocationSlot,
  WalletResponseDto,
  WalletSummaryDto,
  WalletTransactionDto,
} from './wallet.types';

import { MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT } from './wallet-opening-credit';

const MAX_TRANSACTION_ATTEMPTS = 3;

const TOP_UP_DENOMINATIONS = new Set<number>([200, 500, 1_500]);

class TopUpClaimChangedError extends Error {
  constructor() {
    super('Top-up claim changed while processing.');

    this.name = 'TopUpClaimChangedError';
  }
}

interface WalletLedgerRecord {
  id: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  status: WalletTransactionStatus;
  amount: Decimal;
  sourceKey: string;
  description: string | null;
  createdAt: Date;
}

interface WalletBeneficiaryRecord {
  sequence: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
}

interface WalletEarningRecord {
  id: string;
  type: MemberEarningType;
  status: MemberEarningStatus;
  amount: Decimal;
  earnedAt: Date;
}

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

function mapMembershipType(value: MembershipType): WalletMembershipType {
  return value === MembershipType.PREMIUM ? 'premium' : 'basic';
}

function roundMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;

  return Object.is(rounded, -0) ? 0 : rounded;
}

function toSignedLedgerAmount(record: WalletLedgerRecord): Decimal {
  const amount = record.amount.abs();

  switch (record.direction) {
    case WalletTransactionDirection.CREDIT:
      return amount;

    case WalletTransactionDirection.DEBIT:
      return amount.negated();

    case WalletTransactionDirection.NEUTRAL:
    default:
      return new Decimal(0);
  }
}

function mapLedgerType(value: WalletTransactionType): WalletApiTransactionType {
  switch (value) {
    case WalletTransactionType.OPENING_CREDIT:
      return 'opening-credit';

    case WalletTransactionType.TOP_UP:
      return 'top-up';

    case WalletTransactionType.WITHDRAWAL:
      return 'withdrawal';

    case WalletTransactionType.ADJUSTMENT:
      return 'adjustment';

    default: {
      const exhaustiveCheck: never = value;

      return exhaustiveCheck;
    }
  }
}

function mapEarningType(value: MemberEarningType): WalletApiTransactionType {
  switch (value) {
    case MemberEarningType.PAIRING_INCOME:
      return 'pairing-income';

    case MemberEarningType.REFERRAL_COMMISSION:
      return 'referral-commission';

    case MemberEarningType.GROUP_COMMISSION:
      return 'group-commission';

    default: {
      const exhaustiveCheck: never = value;

      return exhaustiveCheck;
    }
  }
}

function mapStatus(
  value: WalletTransactionStatus | MemberEarningStatus,
): WalletApiTransactionStatus {
  switch (value) {
    case WalletTransactionStatus.PENDING:
    case MemberEarningStatus.PENDING:
      return 'pending';

    case WalletTransactionStatus.FAILED:
      return 'failed';

    case WalletTransactionStatus.REVERSED:
    case MemberEarningStatus.REVERSED:
      return 'reversed';

    case WalletTransactionStatus.COMPLETED:
    case MemberEarningStatus.COMPLETED:
      return 'completed';

    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}

function mapDirection(
  value: WalletTransactionDirection,
): WalletApiTransactionDirection {
  switch (value) {
    case WalletTransactionDirection.CREDIT:
      return 'credit';

    case WalletTransactionDirection.DEBIT:
      return 'debit';

    case WalletTransactionDirection.NEUTRAL:
    default:
      return 'neutral';
  }
}

function getLedgerTitle(type: WalletTransactionType): string {
  switch (type) {
    case WalletTransactionType.OPENING_CREDIT:
      return 'Opening Credit';

    case WalletTransactionType.TOP_UP:
      return 'Wallet Top Up';

    case WalletTransactionType.WITHDRAWAL:
      return 'Withdrawal';

    case WalletTransactionType.ADJUSTMENT:
      return 'Wallet Adjustment';

    default: {
      const exhaustiveCheck: never = type;

      return exhaustiveCheck;
    }
  }
}

function getEarningTitle(type: MemberEarningType): string {
  switch (type) {
    case MemberEarningType.PAIRING_INCOME:
      return 'Pairing Income';

    case MemberEarningType.REFERRAL_COMMISSION:
      return 'Referral Commission';

    case MemberEarningType.GROUP_COMMISSION:
      return 'Group Commission';

    default: {
      const exhaustiveCheck: never = type;

      return exhaustiveCheck;
    }
  }
}

function mapLedgerTransaction(
  record: WalletLedgerRecord,
  membershipType: WalletMembershipType,
): WalletTransactionDto {
  const title = getLedgerTitle(record.type);

  return {
    id: record.id,

    type: mapLedgerType(record.type),

    status: mapStatus(record.status),

    direction: mapDirection(record.direction),

    title,

    description: record.description ?? title,

    amount: roundMoney(Math.abs(record.amount.toNumber())),

    createdAt: record.createdAt.toISOString(),

    membershipType,
  };
}

function mapEarningTransaction(
  record: WalletEarningRecord,
  membershipType: WalletMembershipType,
): WalletTransactionDto {
  const amount = record.amount.toNumber();

  const title = getEarningTitle(record.type);

  let direction: WalletApiTransactionDirection = 'neutral';

  if (amount > 0) {
    direction = 'credit';
  } else if (amount < 0) {
    direction = 'debit';
  }

  return {
    id: record.id,

    type: mapEarningType(record.type),

    status: mapStatus(record.status),

    direction,

    title,

    description: `${title} recorded for this member.`,

    amount: roundMoney(Math.abs(amount)),

    createdAt: record.earnedAt.toISOString(),

    membershipType,
  };
}

function summarizeWallet(
  ledger: readonly WalletLedgerRecord[],
  earnings: readonly WalletEarningRecord[],
): WalletSummaryDto {
  let completedFunding = new Decimal(0);

  let pendingFunding = new Decimal(0);

  let lifetimeEarnings = new Decimal(0);

  let pendingEarnings = new Decimal(0);

  let totalWithdrawn = new Decimal(0);

  let referralCommission = new Decimal(0);

  let groupCommission = new Decimal(0);

  for (const transaction of ledger) {
    const signedAmount = toSignedLedgerAmount(transaction);

    if (transaction.status === WalletTransactionStatus.COMPLETED) {
      completedFunding = completedFunding.plus(signedAmount);

      if (
        transaction.type === WalletTransactionType.WITHDRAWAL &&
        transaction.direction === WalletTransactionDirection.DEBIT
      ) {
        totalWithdrawn = totalWithdrawn.plus(transaction.amount.abs());
      }
    }

    if (transaction.status === WalletTransactionStatus.PENDING) {
      pendingFunding = pendingFunding.plus(signedAmount);
    }
  }

  for (const earning of earnings) {
    const amount = earning.amount;

    if (earning.status === MemberEarningStatus.COMPLETED) {
      lifetimeEarnings = lifetimeEarnings.plus(amount);

      if (earning.type === MemberEarningType.REFERRAL_COMMISSION) {
        referralCommission = referralCommission.plus(amount);
      }

      if (earning.type === MemberEarningType.GROUP_COMMISSION) {
        groupCommission = groupCommission.plus(amount);
      }
    }

    if (earning.status === MemberEarningStatus.PENDING) {
      pendingEarnings = pendingEarnings.plus(amount);
    }
  }

  return {
    availableBalance: roundMoney(
      completedFunding.plus(lifetimeEarnings).toNumber(),
    ),

    pendingBalance: roundMoney(pendingFunding.plus(pendingEarnings).toNumber()),

    lifetimeEarnings: roundMoney(lifetimeEarnings.toNumber()),

    totalWithdrawn: roundMoney(totalWithdrawn.toNumber()),

    referralCommission: roundMoney(referralCommission.toNumber()),

    groupCommission: roundMoney(groupCommission.toNumber()),
  };
}

function createOpeningCreditAllocation(
  memberId: string,
  primaryMemberName: string,
  beneficiaries: readonly WalletBeneficiaryRecord[],
  ledger: readonly WalletLedgerRecord[],
): WalletOpeningCreditAllocationDto | null {
  const openingCredit = ledger.find(
    (transaction) =>
      transaction.sourceKey === `opening-credit:${memberId}` &&
      transaction.type === WalletTransactionType.OPENING_CREDIT &&
      transaction.direction === WalletTransactionDirection.CREDIT &&
      transaction.status === WalletTransactionStatus.COMPLETED,
  );

  if (!openingCredit) {
    return null;
  }

  const totalAmount = roundMoney(openingCredit.amount.abs().toNumber());

  const protectedLifeCount = MEMBER_OPENING_CREDIT_PROTECTED_LIFE_COUNT;

  if (!Number.isInteger(protectedLifeCount) || protectedLifeCount <= 0) {
    throw new InternalServerErrorException(
      'Opening credit protected life count must be a positive integer.',
    );
  }

  const amountPerProtectedLife = roundMoney(totalAmount / protectedLifeCount);

  const beneficiariesBySequence = new Map<number, WalletBeneficiaryRecord>(
    beneficiaries
      .filter(
        (beneficiary) =>
          beneficiary.sequence >= 1 &&
          beneficiary.sequence <= MAXIMUM_BENEFICIARIES,
      )
      .map((beneficiary) => [beneficiary.sequence, beneficiary] as const),
  );

  const beneficiaryAllocations = Array.from(
    {
      length: MAXIMUM_BENEFICIARIES,
    },
    (_, index) => {
      const slot = (index + 1) as WalletOpeningCreditAllocationSlot;

      const beneficiary = beneficiariesBySequence.get(slot);

      return {
        role: 'beneficiary' as const,

        slot,

        status: beneficiary ? ('assigned' as const) : ('reserved' as const),

        name: beneficiary
          ? buildFullName(
              beneficiary.firstName,
              beneficiary.middleName,
              beneficiary.lastName,
            )
          : null,

        amount: amountPerProtectedLife,
      };
    },
  );

  return {
    totalAmount,

    protectedLifeCount,

    amountPerProtectedLife,

    allocations: [
      {
        role: 'primary-member',

        slot: 0,

        status: 'assigned',

        name: primaryMemberName,

        amount: amountPerProtectedLife,
      },

      ...beneficiaryAllocations,
    ],
  };
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(memberId: string): Promise<WalletResponseDto> {
    const member = await this.prisma.member.findUnique({
      where: {
        id: memberId,
      },

      select: {
        id: true,

        membershipId: true,

        firstName: true,

        middleName: true,

        lastName: true,

        membershipType: true,

        beneficiaries: {
          orderBy: {
            sequence: 'asc',
          },

          select: {
            sequence: true,

            firstName: true,

            middleName: true,

            lastName: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member account was not found.');
    }

    const [ledger, earnings] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: {
          memberId,
        },

        select: {
          id: true,

          type: true,

          direction: true,

          status: true,

          amount: true,

          sourceKey: true,

          description: true,

          createdAt: true,
        },
      }),

      this.prisma.memberEarning.findMany({
        where: {
          memberId,
        },

        select: {
          id: true,

          type: true,

          status: true,

          amount: true,

          earnedAt: true,
        },
      }),
    ]);

    const membershipType = mapMembershipType(member.membershipType);

    const primaryMemberName = buildFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    );

    const transactions: WalletTransactionDto[] = [
      ...ledger.map((record) => mapLedgerTransaction(record, membershipType)),

      ...earnings.map((record) =>
        mapEarningTransaction(record, membershipType),
      ),
    ];

    transactions.sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.id.localeCompare(left.id),
    );

    return {
      success: true,

      member: {
        id: member.id,

        membershipId: member.membershipId,

        fullName: primaryMemberName,

        membershipType,

        beneficiaries: member.beneficiaries.map((beneficiary) =>
          buildFullName(
            beneficiary.firstName,
            beneficiary.middleName,
            beneficiary.lastName,
          ),
        ),
      },

      openingCreditAllocation: createOpeningCreditAllocation(
        member.id,
        primaryMemberName,
        member.beneficiaries,
        ledger,
      ),

      summary: summarizeWallet(ledger, earnings),

      pairingWindows: [],

      transactions,

      generatedAt: new Date().toISOString(),
    };
  }

  async redeemTopUp(
    memberId: string,
    dto: RedeemTopUpDto,
  ): Promise<RedeemTopUpResponseDto> {
    const normalizedCode = dto.code.trim().toUpperCase();

    if (!normalizedCode) {
      throw new BadRequestException('Top-up code is required.');
    }

    const creditedAmount = await this.runSerializableTransaction(
      (transaction) =>
        this.redeemTopUpInTransaction(transaction, memberId, normalizedCode),
    );

    const wallet = await this.getWallet(memberId);

    return {
      success: true,

      message: `${formatPeso(creditedAmount)} was added to your wallet.`,

      creditedAmount,

      wallet,
    };
  }

  private async redeemTopUpInTransaction(
    transaction: Prisma.TransactionClient,
    memberId: string,
    normalizedCode: string,
  ): Promise<number> {
    const member = await transaction.member.findUnique({
      where: {
        id: memberId,
      },

      select: {
        id: true,

        firstName: true,

        middleName: true,

        lastName: true,

        status: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member account was not found.');
    }

    if (
      member.status === MemberStatus.SUSPENDED ||
      member.status === MemberStatus.DISABLED
    ) {
      throw new ForbiddenException(
        'Your member account is not eligible to redeem top-up codes.',
      );
    }

    const generatedCode = await transaction.generatedCode.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    if (!generatedCode) {
      throw new NotFoundException('Top-up code was not found.');
    }

    if (generatedCode.category !== GeneratedCodeCategory.TOP_UP) {
      throw new BadRequestException('The submitted code is not a top-up code.');
    }

    if (generatedCode.status === GeneratedCodeStatus.USED) {
      const existingAmount = await this.findExistingRedemption(
        transaction,
        generatedCode.id,
        generatedCode.usedByMemberId,
        memberId,
      );

      if (existingAmount !== null) {
        return existingAmount;
      }

      throw new ConflictException('This top-up code has already been used.');
    }

    if (generatedCode.status === GeneratedCodeStatus.EXPIRED) {
      throw new ConflictException('This top-up code has expired.');
    }

    if (generatedCode.status === GeneratedCodeStatus.DISABLED) {
      throw new ConflictException('This top-up code has been disabled.');
    }

    if (
      generatedCode.status !== GeneratedCodeStatus.AVAILABLE &&
      generatedCode.status !== GeneratedCodeStatus.ASSIGNED
    ) {
      throw new ConflictException('This top-up code is not available.');
    }

    const now = new Date();

    if (
      generatedCode.expiresAt &&
      generatedCode.expiresAt.getTime() <= now.getTime()
    ) {
      throw new ConflictException('This top-up code has expired.');
    }

    const creditedAmount = generatedCode.topUpAmount;

    if (
      creditedAmount === null ||
      creditedAmount === undefined ||
      !TOP_UP_DENOMINATIONS.has(creditedAmount)
    ) {
      throw new ConflictException('This top-up code has no valid amount.');
    }

    const memberName = buildFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    );

    const claim = await transaction.generatedCode.updateMany({
      where: {
        id: generatedCode.id,

        category: GeneratedCodeCategory.TOP_UP,

        status: {
          in: [GeneratedCodeStatus.AVAILABLE, GeneratedCodeStatus.ASSIGNED],
        },

        usedByMemberId: null,

        topUpAmount: creditedAmount,

        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },

      data: {
        status: GeneratedCodeStatus.USED,

        usedAt: now,

        usedByMemberId: memberId,

        usedByMemberName: memberName,
      },
    });

    if (claim.count !== 1) {
      throw new TopUpClaimChangedError();
    }

    await transaction.walletTransaction.create({
      data: {
        memberId,

        type: WalletTransactionType.TOP_UP,

        direction: WalletTransactionDirection.CREDIT,

        status: WalletTransactionStatus.COMPLETED,

        amount: new Decimal(creditedAmount),

        sourceKey: `top-up:${generatedCode.id}`,

        generatedCodeId: generatedCode.id,

        description: `${formatPeso(creditedAmount)} top-up voucher redeemed.`,

        createdAt: now,
      },
    });

    return creditedAmount;
  }

  private async findExistingRedemption(
    transaction: Prisma.TransactionClient,
    generatedCodeId: string,
    usedByMemberId: string | null,
    requestingMemberId: string,
  ): Promise<number | null> {
    if (usedByMemberId !== requestingMemberId) {
      return null;
    }

    const transactionRecord = await transaction.walletTransaction.findUnique({
      where: {
        generatedCodeId,
      },

      select: {
        memberId: true,

        type: true,

        direction: true,

        status: true,

        amount: true,
      },
    });

    if (
      !transactionRecord ||
      transactionRecord.memberId !== requestingMemberId ||
      transactionRecord.type !== WalletTransactionType.TOP_UP ||
      transactionRecord.direction !== WalletTransactionDirection.CREDIT ||
      transactionRecord.status !== WalletTransactionStatus.COMPLETED
    ) {
      return null;
    }

    return transactionRecord.amount.toNumber();
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: 'Serializable',

          maxWait: 5_000,

          timeout: 20_000,
        });
      } catch (error: unknown) {
        const isPrismaRetryableError =
          error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');

        const retryable =
          error instanceof TopUpClaimChangedError || isPrismaRetryableError;

        if (!retryable) {
          if (error instanceof Error) {
            throw error;
          }

          throw new InternalServerErrorException(
            'An unexpected error occurred while processing the wallet transaction.',
          );
        }

        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new ConflictException(
            'The wallet changed during top up. Please try again.',
          );
        }
      }
    }

    throw new InternalServerErrorException(
      'The wallet top-up transaction could not be completed.',
    );
  }
}
