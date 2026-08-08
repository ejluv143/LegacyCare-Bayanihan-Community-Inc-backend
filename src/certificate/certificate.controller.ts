import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CertificateService } from './certificate.service';
import type { CertificateResponse } from './certificate.types';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('member/certificate')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get()
  getCertificate(
    @Req() request: AuthenticatedRequest,
  ): Promise<CertificateResponse> {
    return this.certificateService.getCertificate(request.user.sub);
  }
}
