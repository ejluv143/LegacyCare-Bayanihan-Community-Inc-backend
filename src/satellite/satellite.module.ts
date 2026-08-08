import { Module } from '@nestjs/common';

import { SatelliteCodesModule } from './codes/satellite-codes.module';
import { SatelliteGenealogyModule } from './genealogy/satellite-genealogy.module';

@Module({
  imports: [SatelliteCodesModule, SatelliteGenealogyModule],
})
export class SatelliteModule {}
