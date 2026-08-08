import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../admin/database/database.module';

import { AdminSatelliteTransactionsController } from './admin-satellite-transactions.controller';
import { SatelliteTransactionsController } from './satellite-transactions.controller';
import { SatelliteTransactionsService } from './satellite-transactions.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [
    SatelliteTransactionsController,
    AdminSatelliteTransactionsController,
  ],

  providers: [SatelliteTransactionsService],

  // Exported so ClaimsModule can auto-create a CLAIM_PAYOUT transaction
  // when an admin marks a claim as paid.
  exports: [SatelliteTransactionsService],
})
export class SatelliteTransactionsModule {}
