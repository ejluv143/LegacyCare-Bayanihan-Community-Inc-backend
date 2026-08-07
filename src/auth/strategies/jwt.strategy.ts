import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

/* =========================================================
   AUTH TYPES
========================================================= */

export type AuthRole = 'member' | 'admin' | 'satellite-admin';

export type AuthAccountType = 'member' | 'admin' | 'satellite';

/* =========================================================
   JWT PAYLOAD
========================================================= */

export interface JwtPayload {
  sub: string;

  membershipId?: string;

  satelliteId?: string;

  satelliteCode?: string;

  username: string;

  role: AuthRole;

  accountType: AuthAccountType;
}

/* =========================================================
   AUTHENTICATED USER
========================================================= */

export interface AuthenticatedUser {
  sub: string;

  membershipId?: string;

  satelliteId?: string;

  satelliteCode?: string;

  username: string;

  role: AuthRole;

  accountType: AuthAccountType;
}

/* =========================================================
   JWT STRATEGY
========================================================= */

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is missing from the backend environment.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: secret,
    });
  }

  /* =======================================================
     VALIDATE JWT
  ======================================================= */

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      sub: payload.sub,

      membershipId: payload.membershipId,

      satelliteId: payload.satelliteId,

      satelliteCode: payload.satelliteCode,

      username: payload.username,

      role: payload.role,

      accountType: payload.accountType,
    };
  }
}
