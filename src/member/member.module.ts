import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MembersModule } from '../members/members.module';

import { MemberDashboardService } from './member-dashboard.service';
import { MemberController } from './member.controller';

@Module({
  imports: [DatabaseModule, AuthModule, MembersModule],
  controllers: [MemberController],
  providers: [MemberDashboardService],
  exports: [MemberDashboardService],
})
export class MemberModule {}
