import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { MembersModule } from '../members/members.module';

import { MemberDashboardController } from './member-dashboard.controller';
import { MemberDashboardService } from './member-dashboard.service';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule, MembersModule],
  controllers: [MemberDashboardController],
  providers: [MemberDashboardService],
  exports: [MemberDashboardService],
})
export class MemberDashboardModule {}
