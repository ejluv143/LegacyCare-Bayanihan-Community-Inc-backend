import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

/* =========================================================
   MODULE
========================================================= */

@Module({
  imports: [DatabaseModule],

  controllers: [AdminDashboardController],

  providers: [AdminDashboardService],

  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}
