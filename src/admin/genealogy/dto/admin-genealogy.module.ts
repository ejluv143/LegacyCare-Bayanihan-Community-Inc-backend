import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";

import { AdminGenealogyController } from "./admin-genealogy.controller";
import { AdminGenealogyService } from "./admin-genealogy.service";

/* =========================================================
   MODULE
========================================================= */

@Module({
  imports: [
    DatabaseModule,
  ],

  controllers: [
    AdminGenealogyController,
  ],

  providers: [
    AdminGenealogyService,
  ],

  exports: [
    AdminGenealogyService,
  ],
})
export class AdminGenealogyModule {}