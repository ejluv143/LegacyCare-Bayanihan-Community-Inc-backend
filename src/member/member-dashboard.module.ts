import { Module } from "@nestjs/common";

import { DatabaseModule } from "../admin/database/database.module";

import { MemberDashboardController } from "./member-dashboard.controller";
import { MemberDashboardService } from "./member-dashboard.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MemberDashboardController],
  providers: [MemberDashboardService],
  exports: [MemberDashboardService],
})
export class MemberDashboardModule {}