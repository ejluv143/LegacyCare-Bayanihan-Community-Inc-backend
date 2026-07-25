import { Module } from "@nestjs/common";

import { AdminCodesModule } from "../admin/codes/admin-codes.module";
import { DatabaseModule } from "../admin/database/database.module";

import { BeneficiaryController } from "./beneficiary.controller";
import { BeneficiaryService } from "./beneficiary.service";

@Module({
  imports: [
    DatabaseModule,
    AdminCodesModule,
  ],
  controllers: [BeneficiaryController],
  providers: [BeneficiaryService],
  exports: [BeneficiaryService],
})
export class BeneficiaryModule {}