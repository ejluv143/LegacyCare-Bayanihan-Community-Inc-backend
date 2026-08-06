import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../admin/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletController } from './wallet.controller';
import type { WalletService } from './wallet.service';

describe('WalletController authentication contract', () => {
  const getWallet = jest.fn<(memberId: string) => Promise<unknown>>();
  const redeemTopUp =
    jest.fn<(memberId: string, dto: { code: string }) => Promise<unknown>>();
  const controller = new WalletController({
    getWallet,
    redeemTopUp,
  } as unknown as WalletService);

  it('protects every wallet route with JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, WalletController) as
      unknown[] | undefined;

    expect(guards).toContain(JwtAuthGuard);
  });

  it('rejects authenticated non-member accounts', () => {
    expect(() =>
      controller.getWallet({
        user: {
          sub: 'admin-1',
          role: 'admin',
          accountType: 'admin',
        },
      } as never),
    ).toThrow(UnauthorizedException);

    expect(getWallet).not.toHaveBeenCalled();
  });

  it('uses the member UUID from JWT sub', async () => {
    getWallet.mockResolvedValue({ success: true });

    await controller.getWallet({
      user: {
        sub: 'member-1',
        role: 'member',
        accountType: 'member',
      },
    } as never);

    expect(getWallet).toHaveBeenCalledWith('member-1');
  });
});
