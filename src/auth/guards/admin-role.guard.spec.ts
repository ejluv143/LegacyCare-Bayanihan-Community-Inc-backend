import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { AdminRoleGuard } from './admin-role.guard';

interface TestUser {
  role?: string;
  accountType?: string;
}

function createExecutionContext(user?: TestUser): ExecutionContext {
  const request = user ? { user } : {};

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AdminRoleGuard', () => {
  const guard = new AdminRoleGuard();

  it('rejects a request without an authenticated JWT user', () => {
    expect(() => guard.canActivate(createExecutionContext())).toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    {
      role: 'member',
      accountType: 'member',
    },
    {
      role: 'satellite-admin',
      accountType: 'satellite',
    },
    {
      role: 'admin',
      accountType: 'member',
    },
    {
      role: 'member',
      accountType: 'admin',
    },
  ])('rejects a non-admin identity %#', (user) => {
    expect(() => guard.canActivate(createExecutionContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an admin identity with matching role and account type', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          role: 'admin',
          accountType: 'admin',
        }),
      ),
    ).toBe(true);
  });
});
