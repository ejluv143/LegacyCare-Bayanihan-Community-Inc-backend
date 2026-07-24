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
    username?: string;
    role?: string;
  };
}

@Controller("member")
export class MemberController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

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