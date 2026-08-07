import { Controller, Get, Param } from '@nestjs/common';

import { AdminGenealogyService } from './admin-genealogy.service';

/* =========================================================
   CONTROLLER
========================================================= */

@Controller('admin/genealogy')
export class AdminGenealogyController {
  constructor(private readonly adminGenealogyService: AdminGenealogyService) {}

  /* =======================================================
     CLIENT DIRECTORY
  ======================================================= */

  @Get()
  getGenealogyClients() {
    return this.adminGenealogyService.getGenealogyClients();
  }

  /* =======================================================
     SINGLE MEMBER TREE
  ======================================================= */

  @Get(':memberId/tree')
  getGenealogyTree(
    @Param('memberId')
    memberId: string,
  ) {
    return this.adminGenealogyService.getGenealogyTree(memberId);
  }
}
