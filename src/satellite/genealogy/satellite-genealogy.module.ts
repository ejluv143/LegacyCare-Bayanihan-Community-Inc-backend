import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../admin/database/database.module';
import { AuthModule } from '../../auth/auth.module';

import { SatelliteGenealogyController } from './satellite-genealogy.controller';
import { SatelliteGenealogyService } from './satellite-genealogy.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [SatelliteGenealogyController],

  providers: [SatelliteGenealogyService],

  exports: [SatelliteGenealogyService],
})
export class SatelliteGenealogyModule {}
