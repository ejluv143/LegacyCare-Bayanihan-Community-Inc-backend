import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { AdminCodesModule } from './codes/admin-codes.module';
import { AdminDashboardModule } from './dashboard/dto/admin-dashboard.module';
import { DatabaseModule } from './database/database.module';
import { AdminGenealogyModule } from './genealogy/dto/admin-genealogy.module';
import { AdminSatellitesModule } from './satellites/admin-satellites.module';
import { AdminCodeDistributionModule } from './code-distribution/admin-code-distribution.module';

@Module({
  imports: [
    DatabaseModule,

    AdminCodesModule,

    AdminDashboardModule,

    AdminGenealogyModule,

    AdminSatellitesModule,

    AdminCodeDistributionModule,
  ],

  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
