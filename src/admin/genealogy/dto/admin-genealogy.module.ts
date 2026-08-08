import { Module } from '@nestjs/common';

import { AuthModule } from '../../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';

import { AdminGenealogyController } from './admin-genealogy.controller';
import { AdminGenealogyService } from './admin-genealogy.service';

/* =========================================================
   MODULE
========================================================= */

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [AdminGenealogyController],

  providers: [AdminGenealogyService],

  exports: [AdminGenealogyService],
})
export class AdminGenealogyModule {}
