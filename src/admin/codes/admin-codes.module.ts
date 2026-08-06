import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminCodesController } from './admin-codes.controller';
import { AdminCodesService } from './admin-codes.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminCodesController],
  providers: [AdminCodesService],
  exports: [AdminCodesService],
})
export class AdminCodesModule {}
