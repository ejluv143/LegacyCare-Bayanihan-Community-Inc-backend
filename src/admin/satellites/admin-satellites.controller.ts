import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  AdminSatellitesService,
  type AdminIdentity,
  type AdminSatelliteApiResponse,
  type AdminSatelliteListResponse,
  type AdminSatelliteOverviewResponse,
  type AdminSatelliteStatusHistoryResponse,
  type CreateAdminSatelliteResponse,
  type SatelliteMessageResponse,
} from './admin-satellites.service';
import { AdminSatellitesQueryDto } from './dto/admin-satellites-query.dto';
import { CreateAdminSatelliteDto } from './dto/create-admin-satellite.dto';
import { ResetSatellitePasswordDto } from './dto/reset-satellite-password.dto';
import { UpdateAdminSatelliteStatusDto } from './dto/update-admin-satellite-status.dto';
import { UpdateAdminSatelliteDto } from './dto/update-admin-satellite.dto';

interface AuthenticatedAdminRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    adminId?: string;
    name?: string;
    fullName?: string;
    username?: string;
  };
}

const satelliteIdPipe = new ParseUUIDPipe({
  version: '4',
});

function getAdminIdentity(request: AuthenticatedAdminRequest): AdminIdentity {
  return {
    id: request.user?.adminId ?? request.user?.id ?? request.user?.sub ?? null,
    name:
      request.user?.fullName ??
      request.user?.name ??
      request.user?.username ??
      null,
  };
}

@Controller('admin/satellites')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSatellitesController {
  constructor(
    private readonly adminSatellitesService: AdminSatellitesService,
  ) {}

  @Get('overview')
  getOverview(): Promise<AdminSatelliteOverviewResponse> {
    return this.adminSatellitesService.getOverview();
  }

  @Get(':id/status-history')
  getStatusHistory(
    @Param('id', satelliteIdPipe) satelliteId: string,
  ): Promise<AdminSatelliteStatusHistoryResponse> {
    return this.adminSatellitesService.getStatusHistory(satelliteId);
  }

  @Get()
  getSatellites(
    @Query() query: AdminSatellitesQueryDto,
  ): Promise<AdminSatelliteListResponse> {
    return this.adminSatellitesService.getSatellites(query);
  }

  @Get(':id')
  getSatelliteById(
    @Param('id', satelliteIdPipe) satelliteId: string,
  ): Promise<AdminSatelliteApiResponse> {
    return this.adminSatellitesService.getSatelliteById(satelliteId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createSatellite(
    @Body() dto: CreateAdminSatelliteDto,
  ): Promise<CreateAdminSatelliteResponse> {
    return this.adminSatellitesService.createSatellite(dto);
  }

  @Patch(':id')
  updateSatellite(
    @Param('id', satelliteIdPipe) satelliteId: string,
    @Body() dto: UpdateAdminSatelliteDto,
  ): Promise<AdminSatelliteApiResponse> {
    return this.adminSatellitesService.updateSatellite(satelliteId, dto);
  }

  @Patch(':id/status')
  updateSatelliteStatus(
    @Param('id', satelliteIdPipe) satelliteId: string,
    @Body() dto: UpdateAdminSatelliteStatusDto,
    @Req() request: AuthenticatedAdminRequest,
  ): Promise<AdminSatelliteApiResponse> {
    return this.adminSatellitesService.updateSatelliteStatus(
      satelliteId,
      dto,
      getAdminIdentity(request),
    );
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', satelliteIdPipe) satelliteId: string,
    @Body() dto: ResetSatellitePasswordDto,
  ): Promise<SatelliteMessageResponse> {
    return this.adminSatellitesService.resetPassword(satelliteId, dto);
  }

  @Delete(':id')
  deleteSatellite(
    @Param('id', satelliteIdPipe) satelliteId: string,
  ): Promise<SatelliteMessageResponse> {
    return this.adminSatellitesService.deleteSatellite(satelliteId);
  }
}
