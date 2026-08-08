import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClaimsService } from './claims.service';
import { MarkClaimPaidDto } from './dto/mark-claim-paid.dto';
import { SubmitAdminReviewDto } from './dto/submit-admin-review.dto';

interface AuthenticatedAdminRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    adminId?: string;
  };
}

const claimIdPipe = new ParseUUIDPipe({ version: '4' });

function getAdminId(request: AuthenticatedAdminRequest): string | null {
  return request.user?.adminId ?? request.user?.id ?? request.user?.sub ?? null;
}

@Controller('admin/claims')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  getClaims() {
    return this.claimsService.getAdminClaims();
  }

  @Get(':claimId')
  getClaimById(@Param('claimId', claimIdPipe) claimId: string) {
    return this.claimsService.getAdminClaimById(claimId);
  }

  @Post(':claimId/review')
  @HttpCode(HttpStatus.OK)
  submitReview(
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() dto: SubmitAdminReviewDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.claimsService.submitAdminReview(
      claimId,
      getAdminId(request),
      dto,
    );
  }

  @Post(':claimId/processing')
  @HttpCode(HttpStatus.OK)
  markProcessing(
    @Param('claimId', claimIdPipe) claimId: string,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.claimsService.markClaimProcessing(claimId, getAdminId(request));
  }

  @Post(':claimId/paid')
  @HttpCode(HttpStatus.OK)
  markPaid(
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() dto: MarkClaimPaidDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.claimsService.markClaimPaid(claimId, getAdminId(request), dto);
  }
}
