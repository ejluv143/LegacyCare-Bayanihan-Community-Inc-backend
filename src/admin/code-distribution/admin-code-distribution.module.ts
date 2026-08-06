import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

import { AdminCodeDistributionController } from './admin-code-distribution.controller';
import { AdminCodeDistributionService } from './admin-code-distribution.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminCodeDistributionController],
  providers: [AdminCodeDistributionService],
  exports: [AdminCodeDistributionService],
})
export class AdminCodeDistributionModule {}
