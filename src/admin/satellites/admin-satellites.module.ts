import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminSatellitesController } from './admin-satellites.controller';
import { AdminSatellitesService } from './admin-satellites.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminSatellitesController],
  providers: [AdminSatellitesService],
  exports: [AdminSatellitesService],
})
export class AdminSatellitesModule {}
