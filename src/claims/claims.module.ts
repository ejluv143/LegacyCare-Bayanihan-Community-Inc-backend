import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { AdminClaimsController } from './admin-claims.controller';
import { ClaimsService } from './claims.service';
import { MemberClaimsController } from './member-claims.controller';
import { SatelliteClaimsController } from './satellite-claims.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    MemberClaimsController,
    SatelliteClaimsController,
    AdminClaimsController,
  ],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
