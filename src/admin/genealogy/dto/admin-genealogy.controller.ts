import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { AdminRoleGuard } from '../../../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AdminGenealogyService } from './admin-genealogy.service';

/* =========================================================
   CONTROLLER
========================================================= */

@Controller('admin/genealogy')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
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
