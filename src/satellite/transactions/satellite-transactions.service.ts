import { Injectable, NotFoundException } from '@nestjs/common';

import { Decimal } from '@prisma/client/runtime/client';

import { PrismaService } from '../../admin/database/prisma/prisma.service';

import {
  Prisma,
  SatelliteTransaction,
  SatelliteTransactionDirection,
  SatelliteTransactionPaymentMethod,
  SatelliteTransactionStatus,
  SatelliteTransactionType,
} from '../../generated/prisma/client';

import { CreateSatelliteTransactionDto } from './dto/create-satellite-transaction.dto';
import { UpdateSatelliteTransactionStatusDto } from './dto/update-satellite-transaction-status.dto';

import type {
  SatelliteTransactionDirectionValue,
  SatelliteTransactionPaymentMethodValue,
  SatelliteTransactionRecord,
  SatelliteTransactionResponse,
  SatelliteTransactionsResponse,
  SatelliteTransactionStatusValue,
  SatelliteTransactionTypeValue,
} from './satellite-transactions.types';

type TransactionWithSatellite = SatelliteTransaction & {
  satellite: {
    satelliteCode: string;
    satelliteName: string;
  };
};

const transactionInclude = {
  satellite: {
    select: {
      satelliteCode: true,
      satelliteName: true,
    },
  },
} satisfies Prisma.SatelliteTransactionInclude;

/**
 * A claim's requested/approved benefit amount, credited to the
 * satellite's ledger as a completed, system-generated transaction
 * once an admin marks the claim paid. See
 * ClaimsService.markClaimPaid.
 */
export interface ClaimPayoutInput {
  claimId: string;
  claimNumber: string;
  satelliteId: string;
  payoutAmount: number;
  payoutReference: string;
  memberId: string;
  membershipId: string;
  memberName: string;
}

@Injectable()
export class SatelliteTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /* =========================================================
     SATELLITE-FACING
  ========================================================= */

  async getSatelliteTransactions(
    satelliteId: string,
  ): Promise<SatelliteTransactionsResponse> {
    const transactions = await this.prisma.satelliteTransaction.findMany({
      where: { satelliteId },
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Satellite transactions retrieved successfully.',
      transactions: transactions.map((transaction) =>
        this.toRecord(transaction),
      ),
    };
  }

  async getSatelliteTransactionById(
    satelliteId: string,
    transactionId: string,
  ): Promise<SatelliteTransactionResponse> {
    const transaction = await this.prisma.satelliteTransaction.findFirst({
      where: { id: transactionId, satelliteId },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    return {
      success: true,
      message: 'Transaction retrieved successfully.',
      transaction: this.toRecord(transaction),
    };
  }

  /* =========================================================
     ADMIN-FACING
  ========================================================= */

  async getAdminTransactions(
    satelliteId?: string,
  ): Promise<SatelliteTransactionsResponse> {
    const transactions = await this.prisma.satelliteTransaction.findMany({
      where: satelliteId ? { satelliteId } : undefined,
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Satellite transactions retrieved successfully.',
      transactions: transactions.map((transaction) =>
        this.toRecord(transaction),
      ),
    };
  }

  async createTransaction(
    dto: CreateSatelliteTransactionDto,
    adminId: string | null,
    adminName: string | null,
  ): Promise<SatelliteTransactionResponse> {
    const satellite = await this.prisma.satellite.findUnique({
      where: { id: dto.satelliteId },
      select: { id: true },
    });

    if (!satellite) {
      throw new NotFoundException('Satellite not found.');
    }

    let relatedMembershipId: string | null = null;
    let relatedMemberName: string | null = null;

    if (dto.relatedMemberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: dto.relatedMemberId },
        select: {
          membershipId: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      });

      if (!member) {
        throw new NotFoundException('Related member not found.');
      }

      relatedMembershipId = member.membershipId;
      relatedMemberName = [member.firstName, member.middleName, member.lastName]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ');
    }

    const fee = dto.fee ?? 0;
    const netAmount =
      dto.direction === SatelliteTransactionDirection.DEBIT
        ? dto.amount + fee
        : dto.amount - fee;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const transactionNumber = await this.generateTransactionNumber(tx);

      return tx.satelliteTransaction.create({
        data: {
          transactionNumber,
          satelliteId: dto.satelliteId,
          type: dto.type,
          direction: dto.direction,
          status: SatelliteTransactionStatus.COMPLETED,
          amount: new Decimal(dto.amount),
          fee: new Decimal(fee),
          netAmount: new Decimal(netAmount),
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber ?? null,
          description: dto.description,
          relatedMemberId: dto.relatedMemberId ?? null,
          relatedMembershipId,
          relatedMemberName,
          processedByAdminId: adminId,
          processedByAdminName: adminName,
          processedAt: new Date(),
        },
        include: transactionInclude,
      });
    });

    return {
      success: true,
      message: 'Transaction recorded successfully.',
      transaction: this.toRecord(transaction),
    };
  }

  async updateTransactionStatus(
    transactionId: string,
    dto: UpdateSatelliteTransactionStatusDto,
    adminId: string | null,
    adminName: string | null,
  ): Promise<SatelliteTransactionResponse> {
    const existing = await this.prisma.satelliteTransaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found.');
    }

    const transaction = await this.prisma.satelliteTransaction.update({
      where: { id: transactionId },
      data: {
        status: dto.status,
        adminRemarks: dto.adminRemarks ?? undefined,
        processedByAdminId: adminId,
        processedByAdminName: adminName,
        processedAt: new Date(),
      },
      include: transactionInclude,
    });

    return {
      success: true,
      message: 'Transaction status updated successfully.',
      transaction: this.toRecord(transaction),
    };
  }

  /* =========================================================
     AUTO-GENERATED: CLAIM PAYOUT
  ========================================================= */

  /**
   * Called by ClaimsService.markClaimPaid once a claim's payout is
   * released. Credits the satellite's ledger with the payout amount
   * as a completed, system-recorded transaction. Silently does
   * nothing if the claim has no satelliteId -- not every claim is
   * necessarily tied to a satellite.
   */
  async createClaimPayoutTransaction(input: ClaimPayoutInput): Promise<void> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const transactionNumber = await this.generateTransactionNumber(tx);

      return tx.satelliteTransaction.create({
        data: {
          transactionNumber,
          satelliteId: input.satelliteId,
          type: SatelliteTransactionType.CLAIM_PAYOUT,
          direction: SatelliteTransactionDirection.CREDIT,
          status: SatelliteTransactionStatus.COMPLETED,
          amount: new Decimal(input.payoutAmount),
          fee: new Decimal(0),
          netAmount: new Decimal(input.payoutAmount),
          paymentMethod: SatelliteTransactionPaymentMethod.SYSTEM,
          referenceNumber: input.payoutReference,
          description: `Claim payout released for ${input.claimNumber}.`,
          relatedRequestId: input.claimId,
          relatedRequestNumber: input.claimNumber,
          relatedMemberId: input.memberId,
          relatedMembershipId: input.membershipId,
          relatedMemberName: input.memberName,
          processedAt: new Date(),
        },
      });
    });

    void transaction;
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  private async generateTransactionNumber(
    transaction: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `STX-${year}-`;

    const count = await transaction.satelliteTransaction.count({
      where: { transactionNumber: { startsWith: prefix } },
    });

    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private toRecord(
    transaction: TransactionWithSatellite,
  ): SatelliteTransactionRecord {
    return {
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,

      satelliteId: transaction.satelliteId,
      satelliteCode: transaction.satellite.satelliteCode,
      satelliteName: transaction.satellite.satelliteName,

      type: this.mapType(transaction.type),
      direction: this.mapDirection(transaction.direction),
      status: this.mapStatus(transaction.status),

      amount: transaction.amount.toNumber(),
      fee: transaction.fee.toNumber(),
      netAmount: transaction.netAmount.toNumber(),

      paymentMethod: this.mapPaymentMethod(transaction.paymentMethod),
      referenceNumber: transaction.referenceNumber,

      description: transaction.description,

      relatedRequestId: transaction.relatedRequestId,
      relatedRequestNumber: transaction.relatedRequestNumber,

      relatedMemberId: transaction.relatedMemberId,
      relatedMembershipId: transaction.relatedMembershipId,
      relatedMemberName: transaction.relatedMemberName,

      adminRemarks: transaction.adminRemarks,

      processedBy: transaction.processedByAdminName,
      processedAt: transaction.processedAt?.toISOString() ?? null,

      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }

  private mapType(
    type: SatelliteTransactionType,
  ): SatelliteTransactionTypeValue {
    switch (type) {
      case SatelliteTransactionType.CODE_PURCHASE:
        return 'code-purchase';
      case SatelliteTransactionType.ACTIVATION_CODE:
        return 'activation-code';
      case SatelliteTransactionType.TOP_UP_CODE:
        return 'top-up-code';
      case SatelliteTransactionType.BENEFICIARY_CODE:
        return 'beneficiary-code';
      case SatelliteTransactionType.CLAIM_PAYOUT:
        return 'claim-payout';
      case SatelliteTransactionType.REFUND:
        return 'refund';
      case SatelliteTransactionType.ADMIN_ADJUSTMENT:
      default:
        return 'admin-adjustment';
    }
  }

  private mapDirection(
    direction: SatelliteTransactionDirection,
  ): SatelliteTransactionDirectionValue {
    return direction === SatelliteTransactionDirection.CREDIT
      ? 'credit'
      : 'debit';
  }

  private mapStatus(
    status: SatelliteTransactionStatus,
  ): SatelliteTransactionStatusValue {
    switch (status) {
      case SatelliteTransactionStatus.PENDING:
        return 'pending';
      case SatelliteTransactionStatus.PROCESSING:
        return 'processing';
      case SatelliteTransactionStatus.COMPLETED:
        return 'completed';
      case SatelliteTransactionStatus.FAILED:
        return 'failed';
      case SatelliteTransactionStatus.CANCELLED:
        return 'cancelled';
      case SatelliteTransactionStatus.REFUNDED:
      default:
        return 'refunded';
    }
  }

  private mapPaymentMethod(
    paymentMethod: SatelliteTransactionPaymentMethod,
  ): SatelliteTransactionPaymentMethodValue {
    switch (paymentMethod) {
      case SatelliteTransactionPaymentMethod.GCASH:
        return 'gcash';
      case SatelliteTransactionPaymentMethod.MAYA:
        return 'maya';
      case SatelliteTransactionPaymentMethod.BANK_TRANSFER:
        return 'bank-transfer';
      case SatelliteTransactionPaymentMethod.CASH:
        return 'cash';
      case SatelliteTransactionPaymentMethod.WALLET:
        return 'wallet';
      case SatelliteTransactionPaymentMethod.SYSTEM:
      default:
        return 'system';
    }
  }
}
