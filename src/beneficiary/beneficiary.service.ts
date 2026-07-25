import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../admin/database/prisma/prisma.service";

import {
  MAXIMUM_BENEFICIARIES,
  MAX_ID_GENERATION_ATTEMPTS,
} from "./beneficiary.constants";

import {
  createEmptyBeneficiarySlot,
  mapBeneficiary,
  mapBeneficiarySlot,
} from "./beneficiary.mapper";

import type {
  Beneficiary,
  BeneficiariesResponse,
  BeneficiarySlot,
  VerifyBeneficiaryUnlockCodeResponse,
} from "./beneficiary.types";

import {
  createBeneficiaryId,
  findAvailableSequence,
  isUniqueConstraintError,
  normalizeOptionalText,
} from "./beneficiary.utils";

import { CreateBeneficiaryDto } from "./dto/create-beneficiary.dto";
import { UpdateBeneficiaryDto } from "./dto/update-beneficiary.dto";
import { VerifyBeneficiaryUnlockCodeDto } from "./dto/verify-beneficiary-unlock-code.dto";

@Injectable()
export class BeneficiaryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getBeneficiaries(
    primaryMembershipId: string,
  ): Promise<BeneficiariesResponse> {
    const primaryMember =
      await this.findPrimaryMember(
        primaryMembershipId,
      );

    const savedBeneficiaries =
      await this.prisma.beneficiary.findMany({
        where: {
          primaryMemberId: primaryMember.id,
        },
        orderBy: {
          sequence: "asc",
        },
      });

    const beneficiarySlots: BeneficiarySlot[] =
      Array.from(
        {
          length: MAXIMUM_BENEFICIARIES,
        },
        (_, index) => {
          const slotNumber = index + 1;

          const beneficiary =
            savedBeneficiaries.find(
              (item) =>
                item.sequence === slotNumber,
            );

          if (!beneficiary) {
            return createEmptyBeneficiarySlot(
              slotNumber,
            );
          }

          return mapBeneficiarySlot(
            beneficiary,
          );
        },
      );

    const completedCount =
      beneficiarySlots.filter(
        (beneficiary) =>
          beneficiary.status === "completed",
      ).length;

    return {
      beneficiaries: beneficiarySlots,

      maximumBeneficiaries:
        MAXIMUM_BENEFICIARIES,

      completedCount,

      accountActivatedAt:
        primaryMember.activatedAt
          ? primaryMember.activatedAt.toISOString()
          : null,

      /*
       * Temporary value until beneficiary
       * unlock-state fields are added to Prisma.
       */
      accessUnlocked: true,
    };
  }

  async createForMember(
    primaryMembershipId: string,
    input: CreateBeneficiaryDto,
  ): Promise<Beneficiary> {
    const primaryMember =
      await this.findPrimaryMember(
        primaryMembershipId,
      );

    const currentCount =
      await this.prisma.beneficiary.count({
        where: {
          primaryMemberId: primaryMember.id,
        },
      });

    if (
      currentCount >=
      MAXIMUM_BENEFICIARIES
    ) {
      throw new ConflictException(
        `A member may only have ${MAXIMUM_BENEFICIARIES} beneficiaries.`,
      );
    }

    for (
      let attempt = 0;
      attempt <
      MAX_ID_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const usedSequences =
        await this.prisma.beneficiary.findMany({
          where: {
            primaryMemberId:
              primaryMember.id,
          },
          select: {
            sequence: true,
          },
          orderBy: {
            sequence: "asc",
          },
        });

      const sequence =
        findAvailableSequence(
          usedSequences.map(
            (item) => item.sequence,
          ),
        );

      if (sequence === null) {
        throw new ConflictException(
          `A member may only have ${MAXIMUM_BENEFICIARIES} beneficiaries.`,
        );
      }

      const beneficiaryId =
        createBeneficiaryId(
          primaryMember.membershipId,
          sequence,
        );

      try {
        const beneficiary =
          await this.prisma.beneficiary.create({
            data: {
              beneficiaryId,
              sequence,

              primaryMemberId:
                primaryMember.id,

              firstName:
                input.firstName.trim(),

              middleName:
                normalizeOptionalText(
                  input.middleName,
                ),

              lastName:
                input.lastName.trim(),

              address:
                input.address.trim(),

              relationship:
                input.relationship.trim(),
            },
          });

        return mapBeneficiary(
          beneficiary,
        );
      } catch (error: unknown) {
        if (
          isUniqueConstraintError(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      "Unable to generate a unique beneficiary ID. Please try again.",
    );
  }

  async updateBeneficiary(
    primaryMembershipId: string,
    beneficiaryId: string,
    input: UpdateBeneficiaryDto,
  ): Promise<Beneficiary> {
    const primaryMember =
      await this.findPrimaryMember(
        primaryMembershipId,
      );

    const beneficiary =
      await this.prisma.beneficiary.findFirst({
        where: {
          beneficiaryId:
            beneficiaryId.trim(),

          primaryMemberId:
            primaryMember.id,
        },
      });

    if (!beneficiary) {
      throw new NotFoundException(
        "Beneficiary was not found.",
      );
    }

    const updatedBeneficiary =
      await this.prisma.beneficiary.update({
        where: {
          id: beneficiary.id,
        },
        data: {
          firstName:
            input.firstName !== undefined
              ? input.firstName.trim()
              : undefined,

          middleName:
            input.middleName !== undefined
              ? normalizeOptionalText(
                  input.middleName,
                )
              : undefined,

          lastName:
            input.lastName !== undefined
              ? input.lastName.trim()
              : undefined,

          address:
            input.address !== undefined
              ? input.address.trim()
              : undefined,

          relationship:
            input.relationship !== undefined
              ? input.relationship.trim()
              : undefined,
        },
      });

    return mapBeneficiary(
      updatedBeneficiary,
    );
  }

  async deleteBeneficiary(
    primaryMembershipId: string,
    beneficiaryId: string,
  ): Promise<void> {
    const primaryMember =
      await this.findPrimaryMember(
        primaryMembershipId,
      );

    const beneficiary =
      await this.prisma.beneficiary.findFirst({
        where: {
          beneficiaryId:
            beneficiaryId.trim(),

          primaryMemberId:
            primaryMember.id,
        },
        select: {
          id: true,
        },
      });

    if (!beneficiary) {
      throw new NotFoundException(
        "Beneficiary was not found.",
      );
    }

    await this.prisma.beneficiary.delete({
      where: {
        id: beneficiary.id,
      },
    });
  }

  async verifyUnlockCode(
    primaryMembershipId: string,
    input: VerifyBeneficiaryUnlockCodeDto,
  ): Promise<VerifyBeneficiaryUnlockCodeResponse> {
    await this.findPrimaryMember(
      primaryMembershipId,
    );

    const normalizedCode =
      input.code.trim();

    if (!normalizedCode) {
      throw new BadRequestException(
        "Unlock code is required.",
      );
    }

    const configuredUnlockCode =
      process.env.BENEFICIARY_UNLOCK_CODE?.trim();

    if (!configuredUnlockCode) {
      throw new ConflictException(
        "Beneficiary unlock code is not configured.",
      );
    }

    if (
      normalizedCode !== configuredUnlockCode
    ) {
      throw new BadRequestException(
        "The beneficiary unlock code is invalid.",
      );
    }

    /*
     * Temporary implementation.
     *
     * This only validates the environment code.
     * It does not persist an unlocked state yet.
     */
    return {
      success: true,
      unlocked: true,
      message:
        "Beneficiary access has been unlocked successfully.",
    };
  }

  private async findPrimaryMember(
    primaryMembershipId: string,
  ) {
    const normalizedMembershipId =
      primaryMembershipId.trim();

    const primaryMember =
      await this.prisma.member.findUnique({
        where: {
          membershipId:
            normalizedMembershipId,
        },
        select: {
          id: true,
          membershipId: true,
          activatedAt: true,
        },
      });

    if (!primaryMember) {
      throw new NotFoundException(
        "Primary member was not found.",
      );
    }

    return primaryMember;
  }
}