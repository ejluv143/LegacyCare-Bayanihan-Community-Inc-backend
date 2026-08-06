import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminCodeDistributionService } from './admin-code-distribution.service';
import { SendCodesDto } from './dto/send-codes.dto';

@Controller('admin/code-distribution')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminCodeDistributionController {
  constructor(
    private readonly adminCodeDistributionService: AdminCodeDistributionService,
  ) {}

  @Get('satellites')
  getActiveSatellites() {
    return this.adminCodeDistributionService.getActiveSatellites();
  }

  @Post('send')
  sendCodes(
    @Body()
    dto: SendCodesDto,
  ) {
    return this.adminCodeDistributionService.sendCodes(dto);
  }
}
