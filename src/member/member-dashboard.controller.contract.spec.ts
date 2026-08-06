import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../generated/prisma/client', () => ({
  MembershipType: {
    BASIC: 'BASIC',
    PREMIUM: 'PREMIUM',
  },
}));

jest.mock('./member-dashboard.service', () => ({
  MemberDashboardService: class MemberDashboardService {},
}));

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MemberDashboardController } from './member-dashboard.controller';
import type { MemberDashboardService } from './member-dashboard.service';

describe('MemberDashboardController route contract', () => {
  it('exposes the authenticated POST /member/genealogy endpoint', () => {
    // Metadata is attached to the method itself; it is never invoked unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = MemberDashboardController.prototype.createGenealogyMember;

    expect(Reflect.getMetadata(PATH_METADATA, MemberDashboardController)).toBe(
      'member',
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('genealogy');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      JwtAuthGuard,
    );
  });

  it('protects member totals with JwtAuthGuard', () => {
    // Metadata is attached to the method itself; it is never invoked unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = MemberDashboardController.prototype.getMemberTotals;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'dashboard/member-totals',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      JwtAuthGuard,
    );
  });

  it('rejects satellite and admin accounts before calling member totals', () => {
    const getMemberTotals = jest.fn();
    const controller = new MemberDashboardController({
      getMemberTotals,
    } as unknown as MemberDashboardService);
    type MemberTotalsRequest = Parameters<
      MemberDashboardController['getMemberTotals']
    >[0];
    const nonMemberRequests = [
      {
        user: {
          sub: 'satellite-account-1',
          role: 'satellite-admin',
          accountType: 'satellite',
        },
      },
      {
        user: {
          sub: 'admin-account-1',
          role: 'admin',
          accountType: 'admin',
        },
      },
    ] as MemberTotalsRequest[];

    for (const request of nonMemberRequests) {
      expect(() => controller.getMemberTotals(request)).toThrow(
        UnauthorizedException,
      );
    }

    expect(getMemberTotals).not.toHaveBeenCalled();
  });

  it('allows a member account to reach member totals', () => {
    const serviceResult = Promise.resolve({
      success: true,
    });
    const getMemberTotals = jest.fn(() => serviceResult);
    const controller = new MemberDashboardController({
      getMemberTotals,
    } as unknown as MemberDashboardService);
    type MemberTotalsRequest = Parameters<
      MemberDashboardController['getMemberTotals']
    >[0];
    const request = {
      user: {
        sub: 'member-1',
        role: 'member',
        accountType: 'member',
      },
    } as MemberTotalsRequest;

    expect(controller.getMemberTotals(request)).toBe(serviceResult);
    expect(getMemberTotals).toHaveBeenCalledTimes(1);
  });
});
