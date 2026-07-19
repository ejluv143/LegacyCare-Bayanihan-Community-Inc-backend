import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { CreateMemberDto } from '../admin/dto/create-member.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @Get('members')
  getMembers() {
    return this.adminService.getMembers();
  }

  @Post('members')
  createMember(
    @Body()
    createMemberDto: CreateMemberDto,
  ) {
    return this.adminService.createMember(
      createMemberDto,
    );
  }

  @Post(
    'members/:memberId/credentials',
  )
  regenerateMemberCredentials(
    @Param('memberId')
    memberId: string,
  ) {
    return this.adminService
      .regenerateMemberCredentials(
        memberId,
      );
  }
}