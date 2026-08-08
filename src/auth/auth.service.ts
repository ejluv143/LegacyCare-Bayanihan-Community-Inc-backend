import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { JwtService } from '@nestjs/jwt';

import * as argon2 from 'argon2';

import {
  MemberStatus,
  MembershipType,
  SatelliteAccountStatus,
  SatelliteStatus,
} from '../generated/prisma/client';

import { PrismaService } from '../admin/database/prisma/prisma.service';

import { MembersService } from '../members/members.service';

import { LoginDto } from './dto/login.dto';

import { RegisterMemberDto } from './dto/register-member.dto';

/* =========================================================
   FRONTEND TYPES
========================================================= */

type FrontendMemberStatus = 'active' | 'suspended' | 'inactive';

type FrontendMembershipType = 'basic' | 'premium';

/* =========================================================
   MEMBER STATUS MAPPER
========================================================= */

function mapMemberStatus(status: MemberStatus): FrontendMemberStatus {
  switch (status) {
    case MemberStatus.SUSPENDED:
      return 'suspended';

    case MemberStatus.DISABLED:
      return 'inactive';

    case MemberStatus.ACTIVE:
    case MemberStatus.PENDING_ACTIVATION:
    default:
      return 'active';
  }
}

/* =========================================================
   MEMBERSHIP TYPE MAPPER
========================================================= */

function mapMembershipType(
  membershipType: MembershipType,
): FrontendMembershipType {
  switch (membershipType) {
    case MembershipType.PREMIUM:
      return 'premium';

    case MembershipType.BASIC:
    default:
      return 'basic';
  }
}

/* =========================================================
   FULL NAME
========================================================= */

function buildFullName(
  firstName: string,
  middleName: string | null | undefined,
  lastName: string,
): string {
  return [firstName.trim(), middleName?.trim(), lastName.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly membersService: MembersService,

    private readonly jwtService: JwtService,

    private readonly configService: ConfigService,
  ) {}

  /* =======================================================
     REGISTER MEMBER
  ======================================================= */

  async register(dto: RegisterMemberDto) {
    const member = await this.membersService.createMember({
      firstName: dto.firstName,

      middleName: dto.middleName,

      lastName: dto.lastName,

      address: dto.address,

      dateOfBirth: dto.dateOfBirth,

      email: dto.email,

      phone: dto.phone,

      membershipType: dto.membershipType,

      activationCode: dto.activationCode,

      sponsorReferralCode: dto.referralCode,

      satelliteId: dto.satelliteId,

      username: dto.username,

      password: dto.password,

      confirmPassword: dto.confirmPassword,
    });

    return {
      success: true,

      message: 'Registration completed successfully. You may now sign in.',

      user: member,
    };
  }

  /* =======================================================
     LOGIN
  ======================================================= */

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();

    /* =====================================================
       TEMPORARY ADMIN
    ===================================================== */

    const temporaryAdminResult = await this.tryTemporaryAdminLogin(
      username,
      dto.password,
    );

    if (temporaryAdminResult) {
      return temporaryAdminResult;
    }

    /* =====================================================
       SATELLITE ACCOUNT
    ===================================================== */

    const satelliteAccount = await this.prisma.satelliteAccount.findUnique({
      where: {
        username,
      },

      select: {
        id: true,

        satelliteId: true,

        username: true,

        passwordHash: true,

        role: true,

        status: true,

        mustChangePassword: true,

        createdAt: true,

        updatedAt: true,

        satellite: {
          select: {
            id: true,

            satelliteCode: true,

            satelliteName: true,

            status: true,

            manager: {
              select: {
                firstName: true,

                middleName: true,

                lastName: true,

                email: true,

                contactNumber: true,
              },
            },
          },
        },
      },
    });

    if (satelliteAccount) {
      return this.loginSatelliteAccount(satelliteAccount, dto.password);
    }

    /* =====================================================
       NORMAL MEMBER
    ===================================================== */

    return this.loginMember(username, dto.password);
  }

  /* =======================================================
     TEMPORARY ADMIN LOGIN
  ======================================================= */

  private async tryTemporaryAdminLogin(username: string, password: string) {
    const enabled =
      this.configService
        .get<string>('TEMP_ADMIN_ENABLED')
        ?.trim()
        .toLowerCase() === 'true';

    const configuredUsername = this.configService
      .get<string>('TEMP_ADMIN_USERNAME')
      ?.trim()
      .toLowerCase();

    const configuredPassword = this.configService.get<string>(
      'TEMP_ADMIN_PASSWORD',
    );

    if (!enabled || !configuredUsername || username !== configuredUsername) {
      return null;
    }

    if (!configuredPassword || password !== configuredPassword) {
      throw new UnauthorizedException('The username or password is incorrect.');
    }

    const membershipId = 'ADMIN-TEMP-001';

    const token = await this.jwtService.signAsync({
      sub: 'temporary-admin',

      membershipId,

      username: configuredUsername,

      role: 'admin',

      accountType: 'admin',
    });

    const currentDate = new Date().toISOString();

    return {
      success: true,

      message: 'Administrator signed in successfully.',

      token,

      user: {
        id: 'temporary-admin',

        membershipId,

        firstName: 'Legacy Care',

        middleName: null,

        lastName: 'Administrator',

        fullName: 'Legacy Care Administrator',

        username: configuredUsername,

        email:
          this.configService.get<string>('TEMP_ADMIN_EMAIL') ??
          'admin@legacycare.local',

        phone: null,

        membershipType: 'basic' as const,

        referralCode: null,

        role: 'admin' as const,

        accountType: 'admin' as const,

        status: 'active' as const,

        emailVerified: true,

        activated: true,

        mustChangePassword: false,

        createdAt: currentDate,

        updatedAt: currentDate,
      },
    };
  }

  /* =======================================================
     SATELLITE LOGIN
  ======================================================= */

  private async loginSatelliteAccount(
    satelliteAccount: {
      id: string;

      satelliteId: string;

      username: string;

      passwordHash: string;

      role: string;

      status: SatelliteAccountStatus;

      mustChangePassword: boolean;

      createdAt: Date;

      updatedAt: Date;

      satellite: {
        id: string;

        satelliteCode: string;

        satelliteName: string;

        status: SatelliteStatus;

        manager: {
          firstName: string;

          middleName: string | null;

          lastName: string;

          email: string | null;

          contactNumber: string;
        } | null;
      };
    },
    password: string,
  ) {
    const passwordMatches = await this.verifyPassword(
      satelliteAccount.passwordHash,
      password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('The username or password is incorrect.');
    }

    if (satelliteAccount.status !== SatelliteAccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your satellite account is not active. Please contact the administrator.',
      );
    }

    if (satelliteAccount.satellite.status !== SatelliteStatus.ACTIVE) {
      throw new ForbiddenException(
        'This satellite office is not active. Please contact the administrator.',
      );
    }

    const manager = satelliteAccount.satellite.manager;

    const firstName = manager?.firstName ?? 'Satellite';

    const middleName = manager?.middleName ?? null;

    const lastName = manager?.lastName ?? 'Administrator';

    const fullName = buildFullName(firstName, middleName, lastName);

    const token = await this.jwtService.signAsync({
      sub: satelliteAccount.id,

      satelliteId: satelliteAccount.satelliteId,

      satelliteCode: satelliteAccount.satellite.satelliteCode,

      username: satelliteAccount.username,

      role: 'satellite-admin',

      accountType: 'satellite',
    });

    await this.prisma.satelliteAccount.update({
      where: {
        id: satelliteAccount.id,
      },

      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      success: true,

      message: 'Satellite account signed in successfully.',

      token,

      user: {
        id: satelliteAccount.id,

        satelliteId: satelliteAccount.satelliteId,

        satelliteCode: satelliteAccount.satellite.satelliteCode,

        satelliteName: satelliteAccount.satellite.satelliteName,

        /*
         * Kept for compatibility with frontend
         * user types that require membershipId.
         */

        membershipId: satelliteAccount.satellite.satelliteCode,

        firstName,

        middleName,

        lastName,

        fullName,

        username: satelliteAccount.username,

        email: manager?.email ?? null,

        phone: manager?.contactNumber ?? null,

        membershipType: 'basic' as const,

        referralCode: null,

        role: 'satellite-admin' as const,

        accountType: 'satellite' as const,

        status: 'active' as const,

        emailVerified: true,

        activated: true,

        mustChangePassword: satelliteAccount.mustChangePassword,

        createdAt: satelliteAccount.createdAt.toISOString(),

        updatedAt: satelliteAccount.updatedAt.toISOString(),
      },
    };
  }

  /* =======================================================
     MEMBER LOGIN
  ======================================================= */

  private async loginMember(username: string, password: string) {
    const member = await this.prisma.member.findUnique({
      where: {
        username,
      },

      select: {
        id: true,

        membershipId: true,

        firstName: true,

        middleName: true,

        lastName: true,

        username: true,

        email: true,

        phone: true,

        passwordHash: true,

        membershipType: true,

        status: true,

        referralCode: true,

        createdAt: true,

        updatedAt: true,
      },
    });

    if (!member || !member.passwordHash) {
      throw new UnauthorizedException('The username or password is incorrect.');
    }

    const passwordMatches = await this.verifyPassword(
      member.passwordHash,
      password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('The username or password is incorrect.');
    }

    if (member.status === MemberStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your account is suspended. Please contact Legacy Care support.',
      );
    }

    if (member.status === MemberStatus.DISABLED) {
      throw new ForbiddenException(
        'Your account is disabled. Please contact Legacy Care support.',
      );
    }

    const token = await this.jwtService.signAsync({
      sub: member.id,

      membershipId: member.membershipId,

      username: member.username,

      role: 'member',

      accountType: 'member',
    });

    const fullName = buildFullName(
      member.firstName,
      member.middleName,
      member.lastName,
    );

    return {
      success: true,

      message: 'Signed in successfully.',

      token,

      user: {
        id: member.id,

        membershipId: member.membershipId,

        firstName: member.firstName,

        middleName: member.middleName,

        lastName: member.lastName,

        fullName,

        username: member.username,

        email: member.email,

        phone: member.phone,

        membershipType: mapMembershipType(member.membershipType),

        referralCode: member.referralCode,

        role: 'member' as const,

        accountType: 'member' as const,

        status: mapMemberStatus(member.status),

        emailVerified: false,

        activated:
          member.status === MemberStatus.ACTIVE ||
          member.status === MemberStatus.PENDING_ACTIVATION,

        mustChangePassword: false,

        createdAt: member.createdAt.toISOString(),

        updatedAt: member.updatedAt.toISOString(),
      },
    };
  }

  /* =======================================================
     VERIFY ARGON2 PASSWORD
  ======================================================= */

  private async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
