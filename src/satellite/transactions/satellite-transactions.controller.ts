import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SatelliteTransactionsService } from './satellite-transactions.service';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    satelliteId?: string;
    accountType?: string;
  };
}

const transactionIdPipe = new ParseUUIDPipe({ version: '4' });

function getSatelliteId(request: AuthenticatedSatelliteRequest): string {
  if (request.user?.accountType !== 'satellite' || !request.user.satelliteId) {
    throw new ForbiddenException('A satellite account is required.');
  }

  return request.user.satelliteId;
}

/*
 * Read-only: a satellite can review its own financial transaction
 * history, but never create or edit entries directly. Every entry
 * here is either recorded by an admin (code purchases, refunds,
 * adjustments) or generated automatically (claim payouts).
 */
@Controller('satellite/transactions')
@UseGuards(JwtAuthGuard)
export class SatelliteTransactionsController {
  constructor(
    private readonly satelliteTransactionsService: SatelliteTransactionsService,
  ) {}

  @Get()
  getTransactions(@Req() request: AuthenticatedSatelliteRequest) {
    return this.satelliteTransactionsService.getSatelliteTransactions(
      getSatelliteId(request),
    );
  }

  @Get(':transactionId')
  getTransactionById(
    @Req() request: AuthenticatedSatelliteRequest,
    @Param('transactionId', transactionIdPipe) transactionId: string,
  ) {
    return this.satelliteTransactionsService.getSatelliteTransactionById(
      getSatelliteId(request),
      transactionId,
    );
  }
}
