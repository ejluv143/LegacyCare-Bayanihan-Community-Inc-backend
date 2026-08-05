import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AdminSatellitesController } from './admin-satellites.controller';
import { AdminSatellitesService } from './admin-satellites.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminSatellitesController],
  providers: [AdminSatellitesService],
  exports: [AdminSatellitesService],
})
export class AdminSatellitesModule {}
