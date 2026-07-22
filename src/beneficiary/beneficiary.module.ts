import { Module } from "@nestjs/common";

import { DatabaseModule } from "../admin/database/database.module";

import { BeneficiaryController } from "./beneficiary.controller";
import { BeneficiaryService } from "./beneficiary.service";

@Module({
  imports: [DatabaseModule],
  controllers: [BeneficiaryController],
  providers: [BeneficiaryService],
  exports: [BeneficiaryService],
})
export class BeneficiaryModule {}
