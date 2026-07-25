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
import { MembersService } from "../members/members.service";

import { LoginDto } from "./dto/login.dto";
import { RegisterMemberDto } from "./dto/register-member.dto";

type FrontendMemberStatus =
  | "active"
  | "suspended"
  | "inactive";

type FrontendMembershipType =
  | "basic"
  | "premium";

function mapMemberStatus(
  status: MemberStatus,
): FrontendMemberStatus {
  switch (status) {
    case MemberStatus.SUSPENDED:
      return "suspended";

    case MemberStatus.DISABLED:
      return "inactive";

    case MemberStatus.ACTIVE:
    case MemberStatus.PENDING_ACTIVATION:
    default:
      return "active";
  }
}

function mapMembershipType(
  membershipType: MembershipType,
): FrontendMembershipType {
  switch (membershipType) {
    case MembershipType.PREMIUM:
      return "premium";

    case MembershipType.BASIC:
    default:
      return "basic";
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterMemberDto,
  ) {
    const member =
      await this.membersService.createMember({
        firstName: dto.firstName,

        middleName:
          dto.middleName,

        lastName: dto.lastName,

        address: dto.address,

        dateOfBirth:
          dto.dateOfBirth,

        email: dto.email,

        phone: dto.phone,

        membershipType:
          dto.membershipType,

        activationCode:
          dto.activationCode,

        sponsorReferralCode:
          dto.referralCode,

        username: dto.username,

        password: dto.password,

        confirmPassword:
          dto.confirmPassword,
      });

    return {
      success: true,

      message:
        "Registration completed successfully. You may now sign in.",

      user: member,
    };
  }

  async login(dto: LoginDto) {
    const username = dto.username
      .trim()
      .toLowerCase();

    /*
     * Temporary administrator account.
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
        dto.password !== temporaryAdminPassword
      ) {
        throw new UnauthorizedException(
          "The username or password is incorrect.",
        );
      }

      const temporaryAdminMembershipId =
        "ADMIN-TEMP-001";

      const token =
        await this.jwtService.signAsync({
          sub: "temporary-admin",

          membershipId:
            temporaryAdminMembershipId,

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
            temporaryAdminMembershipId,

          firstName:
            "Legacy Care",

          middleName: null,

          lastName:
            "Administrator",

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

          createdAt:
            currentDate,

          updatedAt:
            currentDate,
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

    /*
     * Include membershipId in the JWT payload.
     * JwtStrategy will copy this value to request.user.
     */
    const token =
      await this.jwtService.signAsync({
        sub:
          member.id,

        membershipId:
          member.membershipId,

        username:
          member.username,

        role:
          "member",

        accountType:
          "member",
      });

    return {
      success: true,

      message:
        "Signed in successfully.",

      token,

      user: {
        id:
          member.id,

        membershipId:
          member.membershipId,

        firstName:
          member.firstName,

        middleName:
          member.middleName,

        lastName:
          member.lastName,

        username:
          member.username,

        email:
          member.email,

        phone:
          member.phone,

        membershipType:
          mapMembershipType(
            member.membershipType,
          ),

        referralCode:
          member.referralCode,

        role:
          "member" as const,

        status:
          mapMemberStatus(
            member.status,
          ),

        emailVerified:
          false,

        activated:
          member.status ===
            MemberStatus.ACTIVE ||
          member.status ===
            MemberStatus.PENDING_ACTIVATION,

        createdAt:
          member.createdAt.toISOString(),

        updatedAt:
          member.updatedAt.toISOString(),
      },
    };
  }
}