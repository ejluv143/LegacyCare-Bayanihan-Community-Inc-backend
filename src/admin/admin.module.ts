import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { AdminCodesModule } from './codes/admin-codes.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { DatabaseModule } from './database/database.module';
import { AdminSatellitesModule } from './satellites/admin-satellites.module';

@Module({
  imports: [
    DatabaseModule,

    AdminCodesModule,

    AdminSatellitesModule,

    AdminDashboardModule,
  ],

  controllers: [
    AdminController,
  ],

  providers: [
    AdminService,
  ],

  exports: [
    AdminService,
  ],
})
export class AdminModule {}