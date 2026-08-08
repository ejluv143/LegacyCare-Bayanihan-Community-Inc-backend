import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
