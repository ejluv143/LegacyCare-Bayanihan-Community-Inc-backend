import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../admin/database/database.module';
import { AuthModule } from '../../auth/auth.module';

import { SatelliteCodesController } from './satellite-codes.controller';
import { SatelliteCodesService } from './satellite-codes.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [SatelliteCodesController],

  providers: [SatelliteCodesService],

  exports: [SatelliteCodesService],
})
export class SatelliteCodesModule {}
