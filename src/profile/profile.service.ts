import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as argon2 from 'argon2';

import {
  Prisma,
} from '../generated/prisma/client';

import {
  PrismaService,
} from '../admin/database/prisma/prisma.service';

import {
  UpdateProfileCredentialsDto,
} from './dto/update-profile-credentials.dto';

import {
  UpdateProfileDto,
} from './dto/update-profile.dto';

import type {
  ProfileCredentialsResponse,
  ProfileResponse,
} from './profile.types';

import {
  mapProfileMemberStatus,
  mapProfileMembershipType,
} from './profile.types';

/* =========================================================
   PROFILE MEMBER SELECT
========================================================= */

const profileMemberSelect = {
  id: true,

  membershipId: true,

  firstName: true,

  middleName: true,

  lastName: true,

  username: true,

  email: true,

  phone: true,

  address: true,

  dateOfBirth: true,

  membershipType: true,

  memberSince: true,

  status: true,
} satisfies Prisma.MemberSelect;

/* =========================================================
   PROFILE MEMBER TYPE
========================================================= */

type ProfileMemberRecord =
  Prisma.MemberGetPayload<{
    select: typeof profileMemberSelect;
  }>;

/* =========================================================
   SERVICE
========================================================= */

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /* =======================================================
     GET PROFILE

     GET /api/member/profile
  ======================================================= */

  async getProfile(
    memberId: string,
  ): Promise<ProfileResponse> {
    const member =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select:
          profileMemberSelect,
      });

    if (!member) {
      throw new NotFoundException(
        'Member profile was not found.',
      );
    }

    return this.mapProfile(
      member,
    );
  }

  /* =======================================================
     UPDATE PROFILE

     PATCH /api/member/profile
  ======================================================= */

  async updateProfile(
    memberId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    const existingMember =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select: {
          id: true,
        },
      });

    if (!existingMember) {
      throw new NotFoundException(
        'Member profile was not found.',
      );
    }

    /* =====================================================
       NORMALIZE VALUES
    ===================================================== */

    const firstName =
      dto.firstName.trim();

    const middleName =
      dto.middleName?.trim() ||
      null;

    const lastName =
      dto.lastName.trim();

    const address =
      dto.address?.trim() ||
      null;

    const email =
      dto.email?.trim() ||
      null;

    const phone =
      dto.phone.trim();

    const dateOfBirth =
      this.parseDateOnly(
        dto.dateOfBirth,
      );

    /* =====================================================
       UPDATE MEMBER
    ===================================================== */

    try {
      const member =
        await this.prisma.member.update({
          where: {
            id: memberId,
          },

          data: {
            firstName,

            middleName,

            lastName,

            address,

            dateOfBirth,

            email,

            phone,
          },

          select:
            profileMemberSelect,
        });

      return this.mapProfile(
        member,
      );
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'The email address or phone number is already being used by another member.',
        );
      }

      throw error;
    }
  }

  /* =======================================================
     UPDATE LOGIN CREDENTIALS

     PATCH /api/member/profile/credentials
  ======================================================= */

  async updateCredentials(
    memberId: string,
    dto: UpdateProfileCredentialsDto,
  ): Promise<ProfileCredentialsResponse> {
    /* =====================================================
       GET CURRENT ACCOUNT
    ===================================================== */

    const member =
      await this.prisma.member.findUnique({
        where: {
          id: memberId,
        },

        select: {
          id: true,

          username: true,

          passwordHash: true,
        },
      });

    if (!member) {
      throw new NotFoundException(
        'Member account was not found.',
      );
    }

    if (!member.passwordHash) {
      throw new BadRequestException(
        'This member account does not currently have a password.',
      );
    }

    /* =====================================================
       VERIFY CURRENT PASSWORD
    ===================================================== */

    let passwordIsValid =
      false;

    try {
      passwordIsValid =
        await argon2.verify(
          member.passwordHash,
          dto.currentPassword,
        );
    } catch {
      passwordIsValid =
        false;
    }

    if (!passwordIsValid) {
      throw new UnauthorizedException(
        'Current password is incorrect.',
      );
    }

    /* =====================================================
       NORMALIZE USERNAME
    ===================================================== */

    const username =
      dto.username.trim();

    if (!username) {
      throw new BadRequestException(
        'Username is required.',
      );
    }

    /* =====================================================
       CHECK WHETHER PASSWORD WILL CHANGE
    ===================================================== */

    const newPassword =
      dto.newPassword;

    const confirmPassword =
      dto.confirmPassword;

    const wantsPasswordChange =
      newPassword.length > 0 ||
      confirmPassword.length > 0;

    if (
      wantsPasswordChange &&
      newPassword !==
        confirmPassword
    ) {
      throw new BadRequestException(
        'New password and confirmation do not match.',
      );
    }

    if (
      wantsPasswordChange &&
      newPassword.length < 6
    ) {
      throw new BadRequestException(
        'New password must contain at least 6 characters.',
      );
    }

    /* =====================================================
       CHECK IF ANYTHING ACTUALLY CHANGED
    ===================================================== */

    const usernameChanged =
      username !==
      member.username;

    if (
      !usernameChanged &&
      !wantsPasswordChange
    ) {
      throw new BadRequestException(
        'No credential changes were provided.',
      );
    }

    /* =====================================================
       HASH NEW PASSWORD
    ===================================================== */

    let newPasswordHash:
      string | undefined;

    if (wantsPasswordChange) {
      newPasswordHash =
        await argon2.hash(
          newPassword,
          {
            memoryCost:
              19456,

            timeCost:
              2,

            parallelism:
              1,
          },
        );
    }

    /* =====================================================
       UPDATE CREDENTIALS
    ===================================================== */

    try {
      const updatedMember =
        await this.prisma.member.update({
          where: {
            id: memberId,
          },

          data: {
            username,

            passwordHash:
              newPasswordHash,
          },

          select: {
            username:
              true,
          },
        });

      /* ===================================================
         RESPONSE
      =================================================== */

      let message =
        'Login credentials updated successfully.';

      if (
        usernameChanged &&
        wantsPasswordChange
      ) {
        message =
          'Username and password updated successfully.';
      } else if (
        usernameChanged
      ) {
        message =
          'Username updated successfully.';
      } else if (
        wantsPasswordChange
      ) {
        message =
          'Password updated successfully.';
      }

      return {
        username:
          updatedMember.username,

        message,
      };
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'That username is already being used by another member.',
        );
      }

      throw error;
    }
  }

  /* =======================================================
     MAP DATABASE MEMBER TO FRONTEND PROFILE
  ======================================================= */

  private mapProfile(
    member: ProfileMemberRecord,
  ): ProfileResponse {
    const fullName =
      this.buildFullName(
        member.firstName,
        member.middleName,
        member.lastName,
      );

    return {
      id:
        member.id,

      firstName:
        member.firstName,

      middleName:
        member.middleName,

      lastName:
        member.lastName,

      fullName,

      username:
        member.username,

      address:
        member.address,

      dateOfBirth:
        this.formatDateOnly(
          member.dateOfBirth,
        ),

      email:
        member.email,

      phone:
        member.phone,

      /*
       * No profile_photo column exists yet.
       */

      profilePhoto:
        null,

      membership: {
        membershipId:
          member.membershipId,

        membershipType:
          mapProfileMembershipType(
            member.membershipType,
          ),

        memberSince:
          this.formatDateOnly(
            member.memberSince,
          ),

        status:
          mapProfileMemberStatus(
            member.status,
          ),
      },
    };
  }

  /* =======================================================
     BUILD FULL NAME
  ======================================================= */

  private buildFullName(
    firstName: string,
    middleName: string | null,
    lastName: string,
  ): string {
    return [
      firstName.trim(),

      middleName?.trim(),

      lastName.trim(),
    ]
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .join(' ');
  }

  /* =======================================================
     PARSE YYYY-MM-DD
  ======================================================= */

  private parseDateOnly(
    value:
      | string
      | null
      | undefined,
  ): Date | null {
    if (!value) {
      return null;
    }

    return new Date(
      `${value}T00:00:00.000Z`,
    );
  }

  /* =======================================================
     FORMAT DATE AS YYYY-MM-DD
  ======================================================= */

  private formatDateOnly(
    value:
      | Date
      | null
      | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    return value
      .toISOString()
      .slice(0, 10);
  }
}