import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../admin/database/database.module';

import { SatelliteCodesController } from './satellite-codes.controller';
import { SatelliteCodesService } from './satellite-codes.service';

@Module({
  imports: [DatabaseModule],

  controllers: [SatelliteCodesController],

  providers: [SatelliteCodesService],

  exports: [SatelliteCodesService],
})
export class SatelliteCodesModule {}
