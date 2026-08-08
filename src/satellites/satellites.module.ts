import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { SatellitesController } from './satellites.controller';
import { SatellitesService } from './satellites.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SatellitesController],
  providers: [SatellitesService],
})
export class SatellitesModule {}
