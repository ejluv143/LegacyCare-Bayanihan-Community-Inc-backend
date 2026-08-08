import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClaimDocumentType } from '../generated/prisma/enums';
import { ClaimsService } from './claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UploadClaimDocumentDto } from './dto/upload-claim-document.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

const claimIdPipe = new ParseUUIDPipe({ version: '4' });

@Controller('member/claims')
@UseGuards(JwtAuthGuard)
export class MemberClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  getClaims(@Req() request: AuthenticatedRequest) {
    return this.claimsService.getMemberClaims(request.user.sub);
  }

  @Get(':claimId')
  getClaimById(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', claimIdPipe) claimId: string,
  ) {
    return this.claimsService.getMemberClaimById(request.user.sub, claimId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createClaim(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateClaimDto,
  ) {
    return this.claimsService.createClaim(request.user.sub, dto);
  }

  @Patch(':claimId/documents/:type')
  uploadDocument(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', claimIdPipe) claimId: string,
    @Param('type', new ParseEnumPipe(ClaimDocumentType))
    type: ClaimDocumentType,
    @Body() dto: UploadClaimDocumentDto,
  ) {
    return this.claimsService.uploadMemberClaimDocument(
      request.user.sub,
      claimId,
      type,
      dto,
    );
  }

  @Post(':claimId/resubmit')
  resubmitClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', claimIdPipe) claimId: string,
  ) {
    return this.claimsService.resubmitMemberClaim(request.user.sub, claimId);
  }

  @Post(':claimId/cancel')
  cancelClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', claimIdPipe) claimId: string,
  ) {
    return this.claimsService.cancelMemberClaim(request.user.sub, claimId);
  }
}
