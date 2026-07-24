import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import type { Request } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateGenealogyMemberDto } from "../../src/member/dto/create-genealogy-member.dto";
import { MemberDashboardService } from "./member-dashboard.service";

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    username?: string;
    role?: string;
  };
}

@Controller("member")
@UseGuards(JwtAuthGuard)
export class MemberController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

  @Get("genealogy")
  getGenealogy(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.memberDashboardService.getGenealogy(
      request.user.sub,
    );
  }

  @Post("genealogy")
  createGenealogyMember(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateGenealogyMemberDto,
  ) {
    return this.memberDashboardService.createGenealogyMember(
      request.user.sub,
      dto,
    );
  }
}