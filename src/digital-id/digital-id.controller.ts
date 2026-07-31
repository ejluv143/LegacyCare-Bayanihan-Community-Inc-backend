import {
  Controller,
  Get,
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
  DigitalIdService,
} from './digital-id.service';

import type {
  DigitalIdResponse,
} from './digital-id.types';

/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

interface AuthenticatedRequest
  extends Request {
  user: {
    sub: string;

    username?: string;

    role?: string;
  };
}

/* =========================================================
   CONTROLLER
========================================================= */

@Controller('member/digital-id')
@UseGuards(JwtAuthGuard)
export class DigitalIdController {
  constructor(
    private readonly digitalIdService:
      DigitalIdService,
  ) {}

  /* =======================================================
     GET /api/member/digital-id
  ======================================================= */

  @Get()
  getDigitalId(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<DigitalIdResponse> {
    return this.digitalIdService.getDigitalId(
      request.user.sub,
    );
  }
}