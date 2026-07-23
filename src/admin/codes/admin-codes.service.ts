import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  ActivationCodeType as PrismaActivationCodeType,
  GeneratedCodeCategory as PrismaGeneratedCodeCategory,
  GeneratedCodeStatus as PrismaGeneratedCodeStatus,
  Prisma,
  type GeneratedCode,
  type GeneratedCodeBatch,
} from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';
import { DisableGeneratedCodeDto } from './dto/disable-generated-code.dto';
import {
  ActivationMembershipType,
  GenerateActivationCodesDto,
} from './dto/generate-activation-codes.dto';
import { GenerateBeneficiaryCodesDto } from './dto/generate-beneficiary-codes.dto';
import {
  GenerateTopUpCodesDto,
  TopUpAmount,
} from './dto/generate-top-up-codes.dto';
import {
  GeneratedCodeCategory as QueryCodeCategory,
  GeneratedCodeStatus as QueryCodeStatus,
  GeneratedCodesQueryDto,
} from './dto/generated-codes-query.dto';

const MANILA_TIMEZONE = 'Asia/Manila';
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVATION_CODE_VALIDITY_MS = 72 * 60 * 60 * 1000;

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RANDOM_LENGTH = 8;
const MAX_CODE_GENERATION_ATTEMPTS = 8;
const MAX_TRANSACTION_ATTEMPTS = 3;

const DAILY_LIMITS = {
  basicActivation: 100,
  premiumActivation: 100,
  topUp200: 100,
  topUp500: 100,
  topUp1500: 100,
  beneficiary: 500,
} as const;

const CODE_PREFIXES = {
  basicActivation: 'BA',
  premiumActivation: 'PR',
  topUp200: '200',
  topUp500: '500',
  topUp1500: '1500',
  beneficiary: 'BC',
} as const;

export interface AdminCodeDailyUsage {
  basicActivationGenerated: number;
  premiumActivationGenerated: number;
  topUp200Generated: number;
  topUp500Generated: number;
  topUp1500Generated: number;
  beneficiaryGenerated: number;
}

interface ManilaDayRange {
  date: string;
  start: Date;
  end: Date;
}

interface GenerateCodesOptions {
  category: PrismaGeneratedCodeCategory;
  activationType: PrismaActivationCodeType | null;
  topUpAmount: number | null;
  quantity: number;
  dailyLimit: number;
  prefix: string;
  label: string;
  generatedByAdminId: string | null;
  expiresAfterMs: number | null;
}

function createEmptyDailyUsage(): AdminCodeDailyUsage {
  return {
    basicActivationGenerated: 0,
    premiumActivationGenerated: 0,
    topUp200Generated: 0,
    topUp500Generated: 0,
    topUp1500Generated: 0,
    beneficiaryGenerated: 0,
  };
}

function getManilaDayRange(now = new Date()): ManilaDayRange {
  const manilaDate = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const year = manilaDate.getUTCFullYear();
  const month = manilaDate.getUTCMonth();
  const day = manilaDate.getUTCDate();

  const startTimestamp =
    Date.UTC(year, month, day, 0, 0, 0, 0) - MANILA_UTC_OFFSET_MS;

  const date = [
    String(year).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');

  return {
    date,
    start: new Date(startTimestamp),
    end: new Date(startTimestamp + DAY_MS),
  };
}

function generateRandomSuffix(): string {
  let value = '';

  for (let index = 0; index < CODE_RANDOM_LENGTH; index += 1) {
    value += CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)];
  }

  return value;
}

function toPrismaCategory(
  category: QueryCodeCategory,
): PrismaGeneratedCodeCategory {
  switch (category) {
    case QueryCodeCategory.ACTIVATION:
      return PrismaGeneratedCodeCategory.ACTIVATION;
    case QueryCodeCategory.TOP_UP:
      return PrismaGeneratedCodeCategory.TOP_UP;
    case QueryCodeCategory.BENEFICIARY:
      return PrismaGeneratedCodeCategory.BENEFICIARY;
  }
}

function toPrismaStatus(status: QueryCodeStatus): PrismaGeneratedCodeStatus {
  switch (status) {
    case QueryCodeStatus.AVAILABLE:
      return PrismaGeneratedCodeStatus.AVAILABLE;
    case QueryCodeStatus.USED:
      return PrismaGeneratedCodeStatus.USED;
    case QueryCodeStatus.EXPIRED:
      return PrismaGeneratedCodeStatus.EXPIRED;
    case QueryCodeStatus.DISABLED:
      return PrismaGeneratedCodeStatus.DISABLED;
  }
}

function toPrismaActivationType(
  activationType: ActivationMembershipType,
): PrismaActivationCodeType {
  return activationType === ActivationMembershipType.PREMIUM
    ? PrismaActivationCodeType.PREMIUM
    : PrismaActivationCodeType.BASIC;
}

function toApiCategory(
  category: PrismaGeneratedCodeCategory,
): 'activation' | 'top-up' | 'beneficiary' {
  switch (category) {
    case PrismaGeneratedCodeCategory.ACTIVATION:
      return 'activation';
    case PrismaGeneratedCodeCategory.TOP_UP:
      return 'top-up';
    case PrismaGeneratedCodeCategory.BENEFICIARY:
      return 'beneficiary';
  }
}

function toApiStatus(
  status: PrismaGeneratedCodeStatus,
): 'available' | 'used' | 'expired' | 'disabled' {
  switch (status) {
    case PrismaGeneratedCodeStatus.AVAILABLE:
      return 'available';
    case PrismaGeneratedCodeStatus.USED:
      return 'used';
    case PrismaGeneratedCodeStatus.EXPIRED:
      return 'expired';
    case PrismaGeneratedCodeStatus.DISABLED:
      return 'disabled';
  }
}

function mapGeneratedCode(code: GeneratedCode) {
  return {
    id: code.id,
    code: code.code,
    category: toApiCategory(code.category),
    status: toApiStatus(code.status),
    ...(code.activationType
      ? {
          activationType: code.activationType.toLowerCase() as
            | 'basic'
            | 'premium',
        }
      : {}),
    ...(code.topUpAmount !== null
      ? {
          topUpAmount: code.topUpAmount,
        }
      : {}),
    generatedAt: code.generatedAt.toISOString(),
    generatedByAdminId: code.generatedByAdminId,
    generatedByAdminName: code.generatedByAdminName,
    expiresAt: code.expiresAt?.toISOString() ?? null,
    usedAt: code.usedAt?.toISOString() ?? null,
    usedByMemberId: code.usedByMemberId,
    usedByMemberName: code.usedByMemberName,
    disabledAt: code.disabledAt?.toISOString() ?? null,
    disabledByAdminId: code.disabledByAdminId,
    disabledReason: code.disabledReason,
  };
}

function mapGenerationBatch(batch: GeneratedCodeBatch) {
  return {
    id: batch.id,
    category: toApiCategory(batch.category),
    quantity: batch.quantity,
    ...(batch.activationType
      ? {
          activationType: batch.activationType.toLowerCase() as
            | 'basic'
            | 'premium',
        }
      : {}),
    ...(batch.topUpAmount !== null
      ? {
          topUpAmount: batch.topUpAmount,
        }
      : {}),
    generatedAt: batch.generatedAt.toISOString(),
    generatedByAdminId: batch.generatedByAdminId,
    generatedByAdminName: batch.generatedByAdminName,
  };
}

@Injectable()
export class AdminCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneratedCodes(query: GeneratedCodesQueryDto) {
    await this.expireAvailableCodes();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildGeneratedCodesWhere(query);

    const [total, codes] = await this.prisma.$transaction([
      this.prisma.generatedCode.count({
        where,
      }),
      this.prisma.generatedCode.findMany({
        where,
        orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      codes: codes.map(mapGeneratedCode),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getGeneratedCodeById(codeId: string) {
    await this.expireAvailableCodes();

    const code = await this.prisma.generatedCode.findUnique({
      where: {
        id: codeId,
      },
    });

    if (!code) {
      throw new NotFoundException('Generated code was not found.');
    }

    return mapGeneratedCode(code);
  }

  async getDailySummary() {
    const range = getManilaDayRange();
    const usage = await this.prisma.$transaction((transaction) =>
      this.calculateDailyUsage(transaction, range),
    );

    return {
      date: range.date,
      timezone: MANILA_TIMEZONE,
      usage,
      limits: {
        ...DAILY_LIMITS,
      },
    };
  }

  generateActivationCodes(
    dto: GenerateActivationCodesDto,
    generatedByAdminId: string | null = null,
  ) {
    const activationType = toPrismaActivationType(dto.membershipType);
    const isPremium = activationType === PrismaActivationCodeType.PREMIUM;

    return this.generateCodes({
      category: PrismaGeneratedCodeCategory.ACTIVATION,
      activationType,
      topUpAmount: null,
      quantity: dto.quantity,
      dailyLimit: isPremium
        ? DAILY_LIMITS.premiumActivation
        : DAILY_LIMITS.basicActivation,
      prefix: isPremium
        ? CODE_PREFIXES.premiumActivation
        : CODE_PREFIXES.basicActivation,
      label: `${dto.membershipType} activation`,
      generatedByAdminId,
      expiresAfterMs: ACTIVATION_CODE_VALIDITY_MS,
    });
  }

  generateTopUpCodes(
    dto: GenerateTopUpCodesDto,
    generatedByAdminId: string | null = null,
  ) {
    const settings = {
      [TopUpAmount.PHP_200]: {
        limit: DAILY_LIMITS.topUp200,
        prefix: CODE_PREFIXES.topUp200,
      },
      [TopUpAmount.PHP_500]: {
        limit: DAILY_LIMITS.topUp500,
        prefix: CODE_PREFIXES.topUp500,
      },
      [TopUpAmount.PHP_1500]: {
        limit: DAILY_LIMITS.topUp1500,
        prefix: CODE_PREFIXES.topUp1500,
      },
    } as const;

    const selectedSettings = settings[dto.amount];

    return this.generateCodes({
      category: PrismaGeneratedCodeCategory.TOP_UP,
      activationType: null,
      topUpAmount: dto.amount,
      quantity: dto.quantity,
      dailyLimit: selectedSettings.limit,
      prefix: selectedSettings.prefix,
      label: `₱${dto.amount.toLocaleString('en-PH')} top-up`,
      generatedByAdminId,
      expiresAfterMs: null,
    });
  }

  generateBeneficiaryCodes(
    dto: GenerateBeneficiaryCodesDto,
    generatedByAdminId: string | null = null,
  ) {
    return this.generateCodes({
      category: PrismaGeneratedCodeCategory.BENEFICIARY,
      activationType: null,
      topUpAmount: null,
      quantity: dto.quantity,
      dailyLimit: DAILY_LIMITS.beneficiary,
      prefix: CODE_PREFIXES.beneficiary,
      label: 'beneficiary',
      generatedByAdminId,
      expiresAfterMs: null,
    });
  }

  async getGenerationHistory(query: GeneratedCodesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.GeneratedCodeBatchWhereInput = query.category
      ? {
          category: toPrismaCategory(query.category),
        }
      : {};

    const [total, history] = await this.prisma.$transaction([
      this.prisma.generatedCodeBatch.count({
        where,
      }),
      this.prisma.generatedCodeBatch.findMany({
        where,
        orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      history: history.map(mapGenerationBatch),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async disableGeneratedCode(
    codeId: string,
    dto: DisableGeneratedCodeDto,
    disabledByAdminId: string | null = null,
  ) {
    await this.expireAvailableCodes();

    const updatedCode = await this.runSerializableTransaction(
      async (transaction) => {
        const code = await transaction.generatedCode.findUnique({
          where: {
            id: codeId,
          },
        });

        if (!code) {
          throw new NotFoundException('Generated code was not found.');
        }

        if (code.status !== PrismaGeneratedCodeStatus.AVAILABLE) {
          throw new ConflictException(
            `Only available codes can be disabled. This code is ${toApiStatus(
              code.status,
            )}.`,
          );
        }

        if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
          throw new ConflictException(
            'This code has expired and cannot be disabled.',
          );
        }

        return transaction.generatedCode.update({
          where: {
            id: codeId,
          },
          data: {
            status: PrismaGeneratedCodeStatus.DISABLED,
            disabledAt: new Date(),
            disabledByAdminId,
            disabledReason: dto.reason ?? null,
          },
        });
      },
    );

    return {
      message: 'Generated code disabled successfully.',
      code: mapGeneratedCode(updatedCode),
    };
  }

  private buildGeneratedCodesWhere(
    query: GeneratedCodesQueryDto,
  ): Prisma.GeneratedCodeWhereInput {
    const where: Prisma.GeneratedCodeWhereInput = {};

    if (query.search) {
      where.OR = [
        {
          code: {
            contains: query.search,
          },
        },
        {
          usedByMemberName: {
            contains: query.search,
          },
        },
        {
          generatedByAdminName: {
            contains: query.search,
          },
        },
      ];
    }

    if (query.category) {
      where.category = toPrismaCategory(query.category);
    }

    if (query.status) {
      where.status = toPrismaStatus(query.status);
    }

    if (query.activationType) {
      where.activationType = toPrismaActivationType(query.activationType);
    }

    if (query.topUpAmount) {
      where.topUpAmount = query.topUpAmount;
    }

    return where;
  }

  private async generateCodes(options: GenerateCodesOptions) {
    return this.runSerializableTransaction(async (transaction) => {
      const now = new Date();
      const range = getManilaDayRange(now);

      const dailyWhere: Prisma.GeneratedCodeWhereInput = {
        category: options.category,
        generatedAt: {
          gte: range.start,
          lt: range.end,
        },
        ...(options.activationType
          ? {
              activationType: options.activationType,
            }
          : {}),
        ...(options.topUpAmount !== null
          ? {
              topUpAmount: options.topUpAmount,
            }
          : {}),
      };

      const generatedToday = await transaction.generatedCode.count({
        where: dailyWhere,
      });

      const remaining = Math.max(0, options.dailyLimit - generatedToday);

      if (options.quantity > remaining) {
        throw new BadRequestException({
          message: 'Daily code-generation limit exceeded.',
          errors: {
            quantity: [
              `Only ${remaining} ${options.label} code${
                remaining === 1 ? '' : 's'
              } remaining today.`,
            ],
          },
        });
      }

      const expiresAt =
        options.expiresAfterMs === null
          ? null
          : new Date(now.getTime() + options.expiresAfterMs);

      const batch = await transaction.generatedCodeBatch.create({
        data: {
          category: options.category,
          activationType: options.activationType,
          topUpAmount: options.topUpAmount,
          quantity: options.quantity,
          generatedAt: now,
          generatedByAdminId: options.generatedByAdminId,
        },
      });

      const codeValues = await this.generateUniqueCodeValues(
        transaction,
        options.prefix,
        options.quantity,
      );

      await transaction.generatedCode.createMany({
        data: codeValues.map((code) => ({
          code,
          category: options.category,
          status: PrismaGeneratedCodeStatus.AVAILABLE,
          activationType: options.activationType,
          topUpAmount: options.topUpAmount,
          generatedAt: now,
          generatedByAdminId: options.generatedByAdminId,
          expiresAt,
          generationBatchId: batch.id,
        })),
      });

      const generatedCodes = await transaction.generatedCode.findMany({
        where: {
          generationBatchId: batch.id,
        },
        orderBy: {
          code: 'asc',
        },
      });

      const dailyUsage = await this.calculateDailyUsage(transaction, range);

      return {
        message: `Generated ${generatedCodes.length} ${options.label} code${
          generatedCodes.length === 1 ? '' : 's'
        } successfully.`,
        quantity: generatedCodes.length,
        codes: generatedCodes.map(mapGeneratedCode),
        dailyUsage,
      };
    });
  }

  private async generateUniqueCodeValues(
    transaction: Prisma.TransactionClient,
    prefix: string,
    quantity: number,
  ): Promise<string[]> {
    const values = new Set<string>();

    for (
      let attempt = 0;
      attempt < MAX_CODE_GENERATION_ATTEMPTS && values.size < quantity;
      attempt += 1
    ) {
      while (values.size < quantity) {
        values.add(`${prefix}-${generateRandomSuffix()}`);
      }

      const existingCodes = await transaction.generatedCode.findMany({
        where: {
          code: {
            in: [...values],
          },
        },
        select: {
          code: true,
        },
      });

      for (const existingCode of existingCodes) {
        values.delete(existingCode.code);
      }
    }

    if (values.size < quantity) {
      throw new InternalServerErrorException(
        'Unable to generate unique codes. Please try again.',
      );
    }

    return [...values].slice(0, quantity);
  }

  private async calculateDailyUsage(
    transaction: Prisma.TransactionClient,
    range: ManilaDayRange,
  ): Promise<AdminCodeDailyUsage> {
    const groups = await transaction.generatedCode.groupBy({
      by: ['category', 'activationType', 'topUpAmount'],
      where: {
        generatedAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      _count: {
        _all: true,
      },
    });

    const usage = createEmptyDailyUsage();

    for (const group of groups) {
      const count = group._count._all;

      if (
        group.category === PrismaGeneratedCodeCategory.ACTIVATION &&
        group.activationType === PrismaActivationCodeType.BASIC
      ) {
        usage.basicActivationGenerated += count;
        continue;
      }

      if (
        group.category === PrismaGeneratedCodeCategory.ACTIVATION &&
        group.activationType === PrismaActivationCodeType.PREMIUM
      ) {
        usage.premiumActivationGenerated += count;
        continue;
      }

      if (group.category === PrismaGeneratedCodeCategory.TOP_UP) {
        if (group.topUpAmount === TopUpAmount.PHP_200) {
          usage.topUp200Generated += count;
        } else if (group.topUpAmount === TopUpAmount.PHP_500) {
          usage.topUp500Generated += count;
        } else if (group.topUpAmount === TopUpAmount.PHP_1500) {
          usage.topUp1500Generated += count;
        }

        continue;
      }

      if (group.category === PrismaGeneratedCodeCategory.BENEFICIARY) {
        usage.beneficiaryGenerated += count;
      }
    }

    return usage;
  }

  private expireAvailableCodes() {
    return this.prisma.generatedCode.updateMany({
      where: {
        status: PrismaGeneratedCodeStatus.AVAILABLE,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: PrismaGeneratedCodeStatus.EXPIRED,
      },
    });
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        });
      } catch (error: unknown) {
        if (!this.isRetryableTransactionError(error)) {
          throw error;
        }

        if (attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw new ConflictException(
            'The code inventory changed during generation. Please try again.',
          );
        }
      }
    }

    throw new InternalServerErrorException(
      'The code-generation transaction could not be completed.',
    );
  }

  private isRetryableTransactionError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    );
  }
}
