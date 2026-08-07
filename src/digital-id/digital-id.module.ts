import { Module } from '@nestjs/common';

import { PrismaModule } from '../admin/database/prisma/prisma.module';

import { DigitalIdController } from './digital-id.controller';

import { DigitalIdService } from './digital-id.service';

/* =========================================================
   DIGITAL ID MODULE
========================================================= */

@Module({
  imports: [PrismaModule],

  controllers: [DigitalIdController],

  providers: [DigitalIdService],

  exports: [DigitalIdService],
})
export class DigitalIdModule {}
