import {
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ChatService } from './chat.service';

import type { ChatConversationDetailResponse } from './chat.types';

interface AuthenticatedSatelliteRequest extends Request {
  user?: {
    accountType?: string;
    satelliteId?: string;
  };
}

function getSatelliteId(request: AuthenticatedSatelliteRequest): string {
  if (request.user?.accountType !== 'satellite' || !request.user.satelliteId) {
    throw new ForbiddenException('A satellite account is required.');
  }

  return request.user.satelliteId;
}

// REST counterpart to ChatGateway -- fetches the satellite's one
// conversation with admin plus its message history, so the frontend
// has something to render before (or in place of) the realtime
// socket. See chat.gateway.ts for the live send/receive path.
@Controller('satellite/chat')
@UseGuards(JwtAuthGuard)
export class SatelliteChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversation')
  async getConversation(
    @Req() request: AuthenticatedSatelliteRequest,
  ): Promise<ChatConversationDetailResponse> {
    const satelliteId = getSatelliteId(request);

    const conversation =
      await this.chatService.getOrCreateConversationForSatellite(satelliteId);

    const [summary, messages] = await Promise.all([
      this.chatService.getSummaryById(conversation.id, 'satellite'),
      this.chatService.getMessages(conversation.id),
    ]);

    return { conversation: summary, messages };
  }

  @Patch('conversation/read')
  async markRead(
    @Req() request: AuthenticatedSatelliteRequest,
  ): Promise<{ success: true }> {
    const satelliteId = getSatelliteId(request);

    const conversation =
      await this.chatService.getOrCreateConversationForSatellite(satelliteId);

    await this.chatService.markRead(conversation.id, 'satellite');

    return { success: true };
  }
}
