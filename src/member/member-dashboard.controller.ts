import {
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";

import type { Request } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MemberDashboardService } from "./member-dashboard.service";

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    username: string;
    role: "member" | "admin";
  };
}

@Controller("member")
export class MemberDashboardController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

  @Get("dashboard/member-totals")
  getMemberTotals() {
    return this.memberDashboardService.getMemberTotals();
  }

  @Get("dashboard/recent-verified-members")
  @UseGuards(JwtAuthGuard)
  getRecentVerifiedMembers() {
    return this.memberDashboardService.getRecentVerifiedMembers();
  }

  @Get("genealogy")
  @UseGuards(JwtAuthGuard)
  getGenealogy(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.memberDashboardService.getGenealogy(
      request.user.sub,
    );
  }
}