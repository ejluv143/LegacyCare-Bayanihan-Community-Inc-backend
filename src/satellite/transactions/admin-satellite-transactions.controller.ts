import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SatelliteTransactionsService } from './satellite-transactions.service';
import { CreateSatelliteTransactionDto } from './dto/create-satellite-transaction.dto';
import { UpdateSatelliteTransactionStatusDto } from './dto/update-satellite-transaction-status.dto';

interface AuthenticatedAdminRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    adminId?: string;
    name?: string;
    fullName?: string;
    username?: string;
  };
}

const transactionIdPipe = new ParseUUIDPipe({ version: '4' });

function getAdminId(request: AuthenticatedAdminRequest): string | null {
  return request.user?.adminId ?? request.user?.id ?? request.user?.sub ?? null;
}

function getAdminName(request: AuthenticatedAdminRequest): string | null {
  return (
    request.user?.fullName ??
    request.user?.name ??
    request.user?.username ??
    null
  );
}

@Controller('admin/satellite-transactions')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSatelliteTransactionsController {
  constructor(
    private readonly satelliteTransactionsService: SatelliteTransactionsService,
  ) {}

  @Get()
  getTransactions(
    @Query('satelliteId', new ParseUUIDPipe({ version: '4', optional: true }))
    satelliteId?: string,
  ) {
    return this.satelliteTransactionsService.getAdminTransactions(satelliteId);
  }

  @Post()
  createTransaction(
    @Req() request: AuthenticatedAdminRequest,
    @Body() dto: CreateSatelliteTransactionDto,
  ) {
    return this.satelliteTransactionsService.createTransaction(
      dto,
      getAdminId(request),
      getAdminName(request),
    );
  }

  @Patch(':transactionId/status')
  updateTransactionStatus(
    @Req() request: AuthenticatedAdminRequest,
    @Param('transactionId', transactionIdPipe) transactionId: string,
    @Body() dto: UpdateSatelliteTransactionStatusDto,
  ) {
    return this.satelliteTransactionsService.updateTransactionStatus(
      transactionId,
      dto,
      getAdminId(request),
      getAdminName(request),
    );
  }
}
