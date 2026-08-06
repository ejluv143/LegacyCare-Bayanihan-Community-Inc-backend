import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MemberDashboardService } from './member-dashboard.service';

import { CreateGenealogyMemberDto } from './dto/create-genealogy-member.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub?: string;
    username?: string;
    role?: 'member' | 'admin' | 'satellite-admin';
    accountType?: 'member' | 'admin' | 'satellite';
  };
}

@Controller('member')
export class MemberDashboardController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  getDashboardStats(@Req() request: AuthenticatedRequest) {
    return this.memberDashboardService.getDashboardStats(
      this.getMemberId(request),
    );
  }

  @Get('dashboard/member-totals')
  @UseGuards(JwtAuthGuard)
  getMemberTotals(@Req() request: AuthenticatedRequest) {
    this.getMemberId(request);
    return this.memberDashboardService.getMemberTotals();
  }

  @Get('dashboard/recent-verified-members')
  @UseGuards(JwtAuthGuard)
  getRecentVerifiedMembers(@Req() request: AuthenticatedRequest) {
    this.getMemberId(request);
    return this.memberDashboardService.getRecentVerifiedMembers();
  }

  @Get('top-performers')
  @UseGuards(JwtAuthGuard)
  getTopPerformers(
    @Req() request: AuthenticatedRequest,
    @Query('period') period?: string,
  ) {
    this.getMemberId(request);
    return this.memberDashboardService.getTopPerformers(period);
  }

  @Get('genealogy')
  @UseGuards(JwtAuthGuard)
  getGenealogy(@Req() request: AuthenticatedRequest) {
    return this.memberDashboardService.getGenealogy(this.getMemberId(request));
  }

  @Post('genealogy')
  @UseGuards(JwtAuthGuard)
  createGenealogyMember(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateGenealogyMemberDto,
  ) {
    return this.memberDashboardService.createGenealogyMember(
      this.getMemberId(request),
      dto,
    );
  }

  private getMemberId(request: AuthenticatedRequest): string {
    const user = request.user;

    if (user?.role !== 'member' || user.accountType !== 'member' || !user.sub) {
      throw new UnauthorizedException('A member account is required.');
    }

    return user.sub;
  }
}
