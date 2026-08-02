import {
  Controller,
  Get,
} from "@nestjs/common";

import {
  AdminDashboardService,
} from "./admin-dashboard.service";

/* =========================================================
   CONTROLLER
========================================================= */

@Controller("admin/dashboard")
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService:
      AdminDashboardService,
  ) {}

  /* =======================================================
     MEMBER TOTALS
  ======================================================= */

  @Get("member-totals")
  getMemberTotals() {
    return this.adminDashboardService.getMemberTotals();
  }

  /* =======================================================
     DASHBOARD OVERVIEW
  ======================================================= */

  @Get("overview")
  getOverview() {
    return this.adminDashboardService.getOverview();
  }

  /* =======================================================
     RECENT MEMBERS
  ======================================================= */

  @Get("recent-members")
  getRecentMembers() {
    return this.adminDashboardService.getRecentMembers();
  }

  /* =======================================================
     MEMBER GROWTH
  ======================================================= */

  @Get("member-growth")
  getMemberGrowth() {
    return this.adminDashboardService.getMemberGrowth();
  }
}