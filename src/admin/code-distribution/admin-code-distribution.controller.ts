import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { AdminCodeDistributionService } from './admin-code-distribution.service';
import { SendCodesDto } from './dto/send-codes.dto';

@Controller('admin/code-distribution')
export class AdminCodeDistributionController {
  constructor(
    private readonly adminCodeDistributionService:
      AdminCodeDistributionService,
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