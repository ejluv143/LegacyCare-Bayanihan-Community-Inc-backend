import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import {
  ExtractJwt,
  Strategy,
} from "passport-jwt";

export interface JwtPayload {
  sub: string;
  username: string;
  role: "member" | "admin";
  accountType?: "member" | "admin";
}

export interface AuthenticatedUser {
  sub: string;
  username: string;
  role: "member" | "admin";
  accountType?: "member" | "admin";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  "jwt",
) {
  constructor(
    configService: ConfigService,
  ) {
    const secret =
      configService.get<string>(
        "JWT_SECRET",
      );

    if (!secret) {
      throw new Error(
        "JWT_SECRET is missing from the backend environment.",
      );
    }

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: secret,
    });
  }

  validate(
    payload: JwtPayload,
  ): AuthenticatedUser {
    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      accountType: payload.accountType,
    };
  }
}