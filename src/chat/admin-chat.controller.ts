import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ChatService } from './chat.service';

import type {
  ChatConversationDetailResponse,
  ChatConversationListResponse,
} from './chat.types';

const satelliteIdPipe = new ParseUUIDPipe({ version: '4' });

// REST counterpart to ChatGateway for the admin side -- lists every
// satellite's conversation and fetches one conversation's message
// history. See chat.gateway.ts for the live send/receive path.
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(): Promise<ChatConversationListResponse> {
    return this.chatService.listConversationsForAdmin();
  }

  @Get('conversations/:satelliteId/messages')
  async getConversationMessages(
    @Param('satelliteId', satelliteIdPipe) satelliteId: string,
  ): Promise<ChatConversationDetailResponse> {
    const conversation =
      await this.chatService.getOrCreateConversationForSatellite(satelliteId);

    const [summary, messages] = await Promise.all([
      this.chatService.getSummaryById(conversation.id, 'admin'),
      this.chatService.getMessages(conversation.id),
    ]);

    return { conversation: summary, messages };
  }

  @Patch('conversations/:satelliteId/read')
  async markRead(
    @Param('satelliteId', satelliteIdPipe) satelliteId: string,
  ): Promise<{ success: true }> {
    const conversation =
      await this.chatService.getOrCreateConversationForSatellite(satelliteId);

    await this.chatService.markRead(conversation.id, 'admin');

    return { success: true };
  }
}
