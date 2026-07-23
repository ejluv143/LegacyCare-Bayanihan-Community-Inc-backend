import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminCodesService } from './admin-codes.service';
import { DisableGeneratedCodeDto } from './dto/disable-generated-code.dto';
import { GenerateActivationCodesDto } from './dto/generate-activation-codes.dto';
import { GenerateBeneficiaryCodesDto } from './dto/generate-beneficiary-codes.dto';
import { GenerateTopUpCodesDto } from './dto/generate-top-up-codes.dto';
import { GeneratedCodesQueryDto } from './dto/generated-codes-query.dto';

interface AuthenticatedAdminRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    adminId?: string;
  };
}

const codeIdPipe = new ParseUUIDPipe({
  version: '4',
});

function getAdminId(request: AuthenticatedAdminRequest): string | null {
  return request.user?.adminId ?? request.user?.id ?? request.user?.sub ?? null;
}

@Controller('admin/codes')
export class AdminCodesController {
  constructor(private readonly adminCodesService: AdminCodesService) {}

  @Get('daily-usage')
  getDailyUsage() {
    return this.adminCodesService.getDailySummary();
  }

  @Get('history')
  getGenerationHistory(@Query() query: GeneratedCodesQueryDto) {
    return this.adminCodesService.getGenerationHistory(query);
  }

  @Get()
  getGeneratedCodes(@Query() query: GeneratedCodesQueryDto) {
    return this.adminCodesService.getGeneratedCodes(query);
  }

  @Get(':id')
  getGeneratedCodeById(@Param('id', codeIdPipe) codeId: string) {
    return this.adminCodesService.getGeneratedCodeById(codeId);
  }

  @Post('activation')
  @HttpCode(HttpStatus.CREATED)
  generateActivationCodes(
    @Body() dto: GenerateActivationCodesDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.adminCodesService.generateActivationCodes(
      dto,
      getAdminId(request),
    );
  }

  @Post('top-up')
  @HttpCode(HttpStatus.CREATED)
  generateTopUpCodes(
    @Body() dto: GenerateTopUpCodesDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.adminCodesService.generateTopUpCodes(dto, getAdminId(request));
  }

  @Post('beneficiary')
  @HttpCode(HttpStatus.CREATED)
  generateBeneficiaryCodes(
    @Body() dto: GenerateBeneficiaryCodesDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.adminCodesService.generateBeneficiaryCodes(
      dto,
      getAdminId(request),
    );
  }

  @Patch(':id/disable')
  disableGeneratedCode(
    @Param('id', codeIdPipe) codeId: string,
    @Body() dto: DisableGeneratedCodeDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.adminCodesService.disableGeneratedCode(
      codeId,
      dto,
      getAdminId(request),
    );
  }
}
