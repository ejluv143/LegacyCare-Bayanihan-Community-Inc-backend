import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';

import {
  UpdateProfileDto,
} from './dto/update-profile.dto';

import {
  ProfileService,
} from './profile.service';

import type {
  ProfileResponse,
} from './profile.types';

/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

interface AuthenticatedRequest
  extends Request {
  user: {
    sub: string;

    username?: string;

    role?: string;

    accountType?: string;
  };
}

/* =========================================================
   CONTROLLER
========================================================= */

@Controller('member/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService:
      ProfileService,
  ) {}

  /* =======================================================
     GET PROFILE

     GET /api/member/profile
  ======================================================= */

  @Get()
  getProfile(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<ProfileResponse> {
    return this.profileService.getProfile(
      request.user.sub,
    );
  }

  /* =======================================================
     UPDATE PROFILE

     PATCH /api/member/profile
  ======================================================= */

  @Patch()
  updateProfile(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.profileService.updateProfile(
      request.user.sub,
      dto,
    );
  }
}