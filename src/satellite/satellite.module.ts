import { Module } from '@nestjs/common';

import { SatelliteCodesModule } from './codes/satellite-codes.module';
import { SatelliteGenealogyModule } from './genealogy/satellite-genealogy.module';
import { SatelliteTransactionsModule } from './transactions/satellite-transactions.module';

@Module({
  imports: [
    SatelliteCodesModule,
    SatelliteGenealogyModule,
    SatelliteTransactionsModule,
  ],

  // Re-exported so ClaimsModule can inject SatelliteTransactionsService
  // without importing satellite.module's other, unrelated controllers.
  exports: [SatelliteTransactionsModule],
})
export class SatelliteModule {}
