import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../admin/database/prisma/prisma.service";

export interface CreateBeneficiaryInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  address: string;
  relationship: string;
}

const MAX_ID_GENERATION_ATTEMPTS = 5;

@Injectable()
export class BeneficiaryService {
  constructor(private readonly prisma: PrismaService) {}

  async createForMember(
    primaryMembershipId: string,
    input: CreateBeneficiaryInput,
  ) {
    const primaryMember = await this.prisma.member.findUnique({
      where: {
        membershipId: primaryMembershipId.trim(),
      },
      select: {
        id: true,
        membershipId: true,
      },
    });

    if (!primaryMember) {
      throw new NotFoundException("Primary member was not found.");
    }

    for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt += 1) {
      const latestBeneficiary = await this.prisma.beneficiary.aggregate({
        where: {
          primaryMemberId: primaryMember.id,
        },
        _max: {
          sequence: true,
        },
      });

      const sequence = (latestBeneficiary._max.sequence ?? 0) + 1;
      const beneficiaryId = createBeneficiaryId(
        primaryMember.membershipId,
        sequence,
      );

      try {
        return await this.prisma.beneficiary.create({
          data: {
            beneficiaryId,
            sequence,
            primaryMemberId: primaryMember.id,
            firstName: input.firstName.trim(),
            middleName: input.middleName?.trim() || null,
            lastName: input.lastName.trim(),
            address: input.address.trim(),
            relationship: input.relationship.trim(),
          },
          include: {
            primaryMember: {
              select: {
                id: true,
                membershipId: true,
              },
            },
          },
        });
      } catch (error: unknown) {
        if (isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      "Unable to generate a unique beneficiary ID. Please try again.",
    );
  }
}

function createBeneficiaryId(
  primaryMembershipId: string,
  sequence: number,
): string {
  const sequenceText = String(sequence).padStart(2, "0");

  return `${primaryMembershipId}-B${sequenceText}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
