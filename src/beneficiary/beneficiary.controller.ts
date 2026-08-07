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
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { BeneficiaryService } from './beneficiary.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { VerifyBeneficiaryUnlockCodeDto } from './dto/verify-beneficiary-unlock-code.dto';

interface AuthenticatedMemberRequest {
  user?: {
    sub?: string;
    membershipId?: string;
    username?: string;
    role?: 'member' | 'admin';
    accountType?: 'member' | 'admin';
  };
}

@Controller('member/beneficiaries')
@UseGuards(JwtAuthGuard)
export class BeneficiaryController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  @Get()
  getBeneficiaries(@Req() request: AuthenticatedMemberRequest) {
    return this.beneficiaryService.getBeneficiaries(
      this.getMemberIdentifier(request),
    );
  }

  @Post()
  createBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    return this.beneficiaryService.createForMember(
      this.getMemberIdentifier(request),
      dto,
    );
  }

  @Post('unlock')
  verifyUnlockCode(
    @Req() request: AuthenticatedMemberRequest,
    @Body() dto: VerifyBeneficiaryUnlockCodeDto,
  ) {
    return this.beneficiaryService.verifyUnlockCode(
      this.getMemberIdentifier(request),
      dto,
    );
  }

  @Patch(':beneficiaryId')
  updateBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Param('beneficiaryId') beneficiaryId: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    return this.beneficiaryService.updateBeneficiary(
      this.getMemberIdentifier(request),
      beneficiaryId,
      dto,
    );
  }

  @Delete(':beneficiaryId')
  deleteBeneficiary(
    @Req() request: AuthenticatedMemberRequest,
    @Param('beneficiaryId') beneficiaryId: string,
  ) {
    return this.beneficiaryService.deleteBeneficiary(
      this.getMemberIdentifier(request),
      beneficiaryId,
    );
  }

  private getMemberIdentifier(request: AuthenticatedMemberRequest): string {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (user.role !== 'member' || user.accountType !== 'member') {
      throw new UnauthorizedException('A member account is required.');
    }

    const memberIdentifier = user.membershipId ?? user.sub;

    if (!memberIdentifier) {
      throw new UnauthorizedException(
        'The authenticated member ID was not found.',
      );
    }

    return memberIdentifier;
  }
}
