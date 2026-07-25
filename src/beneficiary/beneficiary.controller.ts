import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { BeneficiaryService } from "./beneficiary.service";
import { CreateBeneficiaryDto } from "./dto/create-beneficiary.dto";
import { UpdateBeneficiaryDto } from "./dto/update-beneficiary.dto";
import { VerifyBeneficiaryUnlockCodeDto } from "./dto/verify-beneficiary-unlock-code.dto";

interface AuthenticatedMemberRequest {
  user?: {
    sub?: string;
    membershipId?: string;

    member?: {
      membershipId?: string;
    };
  };
}

@Controller("member/beneficiaries")
@UseGuards(JwtAuthGuard)
export class BeneficiaryController {
  constructor(
    private readonly beneficiaryService: BeneficiaryService,
  ) {}

  @Get()
  getBeneficiaries(
    @Req() request: AuthenticatedMemberRequest,
  ) {
    return this.beneficiaryService.getBeneficiaries(
      this.getMembershipId(request),
    );
  }

  @Post()
  createBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    return this.beneficiaryService.createForMember(
      this.getMembershipId(request),
      dto,
    );
  }

  @Patch(":beneficiaryId")
  updateBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Param("beneficiaryId")
    beneficiaryId: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    return this.beneficiaryService.updateBeneficiary(
      this.getMembershipId(request),
      beneficiaryId,
      dto,
    );
  }

  @Delete(":beneficiaryId")
  deleteBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Param("beneficiaryId")
    beneficiaryId: string,
  ) {
    return this.beneficiaryService.deleteBeneficiary(
      this.getMembershipId(request),
      beneficiaryId,
    );
  }

  @Post("unlock")
  verifyUnlockCode(
    @Req() request: AuthenticatedMemberRequest,
    @Body() dto: VerifyBeneficiaryUnlockCodeDto,
  ) {
    return this.beneficiaryService.verifyUnlockCode(
      this.getMembershipId(request),
      dto,
    );
  }

  private getMembershipId(
    request: AuthenticatedMemberRequest,
  ): string {
    const membershipId =
      request.user?.membershipId ??
      request.user?.member?.membershipId;

    if (!membershipId) {
      throw new UnauthorizedException(
        "The authenticated member ID was not found.",
      );
    }

    return membershipId;
  }
}