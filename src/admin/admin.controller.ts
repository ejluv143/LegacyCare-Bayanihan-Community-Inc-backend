import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { CreateMemberDto } from './database/create-member.dto';
import { UpdateMemberStatusDto } from './database/update-member-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('members')
  getMembers() {
    return this.adminService.getMembers();
  }

  @Post('members')
  createMember(
    @Body()
    createMemberDto: CreateMemberDto,
  ) {
    return this.adminService.createMember(createMemberDto);
  }

  @Post('members/:memberId/credentials')
  regenerateMemberCredentials(
    @Param('memberId')
    memberId: string,
  ) {
    return this.adminService.regenerateMemberCredentials(memberId);
  }

  @Patch('members/:memberId/status')
  updateMemberStatus(
    @Param('memberId')
    memberId: string,

    @Body()
    updateMemberStatusDto: UpdateMemberStatusDto,
  ) {
    return this.adminService.updateMemberStatus(
      memberId,
      updateMemberStatusDto,
    );
  }
}
