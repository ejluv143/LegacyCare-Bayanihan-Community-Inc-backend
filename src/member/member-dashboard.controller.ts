import { Controller, Get } from "@nestjs/common";

import { MemberDashboardService } from "./member-dashboard.service";

@Controller("member/dashboard")
export class MemberDashboardController {
  constructor(
    private readonly memberDashboardService: MemberDashboardService,
  ) {}

  @Get("member-totals")
  getMemberTotals() {
    return this.memberDashboardService.getMemberTotals();
  }
}