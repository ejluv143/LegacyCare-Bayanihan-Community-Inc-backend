import { Module } from '@nestjs/common';

import { SatelliteCodesModule } from './codes/satellite-codes.module';

@Module({
  imports: [SatelliteCodesModule],
})
export class SatelliteModule {}
