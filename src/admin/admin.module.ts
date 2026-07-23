import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCodesModule } from './codes/admin-codes.module';
import { DatabaseModule } from './database/database.module';
import { AdminSatellitesModule } from './satellites/admin-satellites.module';

@Module({
  imports: [
    DatabaseModule,
    AdminCodesModule,
    AdminSatellitesModule,
  ],

  controllers: [
    AdminController,
  ],

  providers: [
    AdminService,
  ],

  // Required so AuthModule can inject AdminService.
  exports: [
    AdminService,
  ],
})
export class AdminModule {}