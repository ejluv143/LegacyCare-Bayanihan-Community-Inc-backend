import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import * as argon2 from "argon2";

import {
  MemberStatus,
  MembershipType,
} from "../generated/prisma/client";

import { PrismaService } from "../admin/database/prisma/prisma.service";

import { LoginDto } from "./dto/login.dto";

type FrontendMemberStatus =
  | "pending"
  | "active"
  | "suspended"
  | "inactive";

function mapMemberStatus(
  status: MemberStatus,
): FrontendMemberStatus {
  switch (status) {
    case MemberStatus.ACTIVE:
      return "active";

    case MemberStatus.SUSPENDED:
      return "suspended";

    case MemberStatus.DISABLED:
      return "inactive";

    case MemberStatus.PENDING_ACTIVATION:
    default:
      return "pending";
  }
}

function mapMembershipType(
  membershipType: MembershipType,
): "basic" {
  switch (membershipType) {
    case MembershipType.BASIC:
    default:
      return "basic";
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const username =
      dto.username.trim().toLowerCase();

    /*
     * Temporary administrator account.
     *
     * This is checked before querying the member
     * database because the temporary administrator
     * does not have a database record.
     */
    const temporaryAdminEnabled =
      this.configService
        .get<string>(
          "TEMP_ADMIN_ENABLED",
        )
        ?.trim()
        .toLowerCase() === "true";

    const temporaryAdminUsername =
      this.configService
        .get<string>(
          "TEMP_ADMIN_USERNAME",
        )
        ?.trim()
        .toLowerCase();

    const temporaryAdminPassword =
      this.configService.get<string>(
        "TEMP_ADMIN_PASSWORD",
      );

    if (
      temporaryAdminEnabled &&
      temporaryAdminUsername &&
      username === temporaryAdminUsername
    ) {
      if (
        !temporaryAdminPassword ||
        dto.password !==
          temporaryAdminPassword
      ) {
        throw new UnauthorizedException(
          "The username or password is incorrect.",
        );
      }

      const token =
        await this.jwtService.signAsync({
          sub: "temporary-admin",
          username:
            temporaryAdminUsername,
          role: "admin",
          accountType: "admin",
        });

      const currentDate =
        new Date().toISOString();

      return {
        success: true,
        message:
          "Administrator signed in successfully.",
        token,

        user: {
          id: "temporary-admin",

          membershipId:
            "ADMIN-TEMP-001",

          firstName: "Legacy Care",

          lastName: "Administrator",

          username:
            temporaryAdminUsername,

          email:
            this.configService.get<string>(
              "TEMP_ADMIN_EMAIL",
            ) ??
            "admin@legacycare.local",

          phone: null,

          membershipType:
            "basic" as const,

          referralCode: null,

          role: "admin" as const,

          status: "active" as const,

          emailVerified: true,

          activated: true,

          createdAt: currentDate,

          updatedAt: currentDate,
        },
      };
    }

    /*
     * Normal member login.
     */
    const member =
      await this.prisma.member.findUnique({
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

    /*
     * Use the same response for missing users,
     * missing hashes, and incorrect passwords.
     * This avoids revealing which usernames exist.
     */
    if (
      !member ||
      !member.passwordHash
    ) {
      throw new UnauthorizedException(
        "The username or password is incorrect.",
      );
    }

    let passwordMatches = false;

    try {
      passwordMatches =
        await argon2.verify(
          member.passwordHash,
          dto.password,
        );
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      throw new UnauthorizedException(
        "The username or password is incorrect.",
      );
    }

    /*
     * Pending members are temporarily allowed
     * to sign in. A three-day activation deadline
     * can be enforced here later.
     */

    if (
      member.status ===
      MemberStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        "Your account is suspended. Please contact Legacy Care support.",
      );
    }

    if (
      member.status ===
      MemberStatus.DISABLED
    ) {
      throw new ForbiddenException(
        "Your account is disabled. Please contact Legacy Care support.",
      );
    }

    const token =
      await this.jwtService.signAsync({
        sub: member.id,
        username: member.username,
        role: "member",
        accountType: "member",
      });

    return {
      success: true,
      message: "Signed in successfully.",
      token,

      user: {
        id: member.id,

        membershipId:
          member.membershipId,

        firstName: member.firstName,

        lastName: member.lastName,

        username: member.username,

        email: member.email,

        phone: member.phone,

        membershipType:
          mapMembershipType(
            member.membershipType,
          ),

        referralCode:
          member.referralCode,

        role: "member" as const,

        status: mapMemberStatus(
          member.status,
        ),

        emailVerified: false,

        activated:
          member.status ===
          MemberStatus.ACTIVE,

        createdAt:
          member.createdAt.toISOString(),

        updatedAt:
          member.updatedAt.toISOString(),
      },
    };
  }
}