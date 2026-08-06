import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../generated/prisma/client', () => ({
  MembershipType: {
    BASIC: 'BASIC',
    PREMIUM: 'PREMIUM',
  },
}));

jest.mock('./admin.service', () => ({
  AdminService: class AdminService {},
}));

jest.mock('./codes/admin-codes.service', () => ({
  AdminCodesService: class AdminCodesService {},
}));

jest.mock('./code-distribution/admin-code-distribution.service', () => ({
  AdminCodeDistributionService: class AdminCodeDistributionService {},
}));

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminCodeDistributionController } from './code-distribution/admin-code-distribution.controller';
import { AdminCodesController } from './codes/admin-codes.controller';
import { AdminController } from './admin.controller';

describe('admin controller security contract', () => {
  it.each([
    ['AdminController', AdminController],
    ['AdminCodesController', AdminCodesController],
    ['AdminCodeDistributionController', AdminCodeDistributionController],
  ])(
    'protects %s with JWT authentication and the admin role guard',
    (_, controller) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as
        unknown[] | undefined;

      expect(guards).toEqual(
        expect.arrayContaining([JwtAuthGuard, AdminRoleGuard]),
      );
      expect(guards?.indexOf(JwtAuthGuard)).toBeLessThan(
        guards?.indexOf(AdminRoleGuard) ?? -1,
      );
    },
  );
});
