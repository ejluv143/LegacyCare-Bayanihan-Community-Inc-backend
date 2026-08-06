import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('member/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMemberNotifications(@Req() request: AuthenticatedRequest) {
    return await this.notificationsService.getMemberNotifications(
      request.user.sub,
    );
  }

  @Patch('read-all')
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(request.user.sub);
  }

  @Patch(':notificationId/read')
  markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      request.user.sub,
      notificationId,
    );
  }
}
