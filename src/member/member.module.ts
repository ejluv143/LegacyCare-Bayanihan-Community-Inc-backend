import { Module } from "@nestjs/common";

import { DatabaseModule } from "../admin/database/database.module";
import { AuthModule } from "../auth/auth.module";
import { MembersModule } from "../members/members.module";

import { MemberController } from "./member.controller";
import { MemberDashboardService } from "./member-dashboard.service";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    MembersModule,
  ],

  controllers: [
    MemberController,
  ],

  providers: [
    MemberDashboardService,
  ],

  exports: [
    MemberDashboardService,
  ],
})
export class MemberModule {}