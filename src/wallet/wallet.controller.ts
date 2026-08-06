import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedeemTopUpDto } from './dto/redeem-top-up.dto';
import { WalletService } from './wallet.service';

interface AuthenticatedMemberRequest extends Request {
  user?: {
    sub?: string;
    role?: string;
    accountType?: string;
  };
}

@Controller('member/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@Req() request: AuthenticatedMemberRequest) {
    return this.walletService.getWallet(this.getMemberId(request));
  }

  @Post('top-ups/redeem')
  @HttpCode(HttpStatus.OK)
  redeemTopUp(
    @Req() request: AuthenticatedMemberRequest,
    @Body() dto: RedeemTopUpDto,
  ) {
    return this.walletService.redeemTopUp(this.getMemberId(request), dto);
  }

  private getMemberId(request: AuthenticatedMemberRequest): string {
    const user = request.user;

    if (user?.role !== 'member' || user.accountType !== 'member' || !user.sub) {
      throw new UnauthorizedException('A member account is required.');
    }

    return user.sub;
  }
}
