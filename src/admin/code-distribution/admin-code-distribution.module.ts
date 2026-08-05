import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { AdminCodeDistributionController } from './admin-code-distribution.controller';
import { AdminCodeDistributionService } from './admin-code-distribution.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminCodeDistributionController],
  providers: [AdminCodeDistributionService],
  exports: [AdminCodeDistributionService],
})
export class AdminCodeDistributionModule {}
