import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../admin/database/prisma/prisma.service';

import {
  ChatSenderRole,
  Prisma,
  type ChatConversation,
  type ChatMessage,
} from '../generated/prisma/client';

import type {
  ChatAttachment,
  ChatConversationListResponse,
  ChatConversationSummary,
  ChatMessageResponse,
  CreateChatMessageInput,
} from './chat.types';

/**
 * There's only one admin identity in the system right now (see
 * AuthService.tryTemporaryAdminLogin), so this is the fixed
 * ChatMessage.senderId used for every admin-authored message.
 */
export const ADMIN_SENDER_ID = 'temporary-admin';

const MAX_MESSAGE_HISTORY = 200;

const MAX_PREVIEW_LENGTH = 500;

type ConversationWithSatellite = ChatConversation & {
  satellite: {
    id: string;
    satelliteCode: string;
    satelliteName: string;
  };
};

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /* =======================================================
     GET OR CREATE (satellite's own conversation)
  ======================================================= */

  async getOrCreateConversationForSatellite(
    satelliteId: string,
  ): Promise<ChatConversation> {
    const existing = await this.prisma.chatConversation.findUnique({
      where: { satelliteId },
    });

    if (existing) {
      return existing;
    }

    const satellite = await this.prisma.satellite.findUnique({
      where: { id: satelliteId },
      select: { id: true },
    });

    if (!satellite) {
      throw new NotFoundException('Satellite not found.');
    }

    try {
      return await this.prisma.chatConversation.create({
        data: { satelliteId },
      });
    } catch {
      // Two near-simultaneous first messages can race to create the
      // same conversation; the unique(satelliteId) constraint means
      // the loser here just needs to re-read the winner's row.
      const conversation = await this.prisma.chatConversation.findUnique({
        where: { satelliteId },
      });

      if (!conversation) {
        throw new BadRequestException('Unable to start the conversation.');
      }

      return conversation;
    }
  }

  /* =======================================================
     GET (with ownership check for satellite callers)
  ======================================================= */

  async getConversationForSatellite(
    conversationId: string,
    satelliteId: string,
  ): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.satelliteId !== satelliteId) {
      throw new ForbiddenException(
        'This conversation does not belong to your satellite account.',
      );
    }

    return conversation;
  }

  async getConversationById(conversationId: string): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return conversation;
  }

  /* =======================================================
     LIST (admin's conversation list)
  ======================================================= */

  async listConversationsForAdmin(): Promise<ChatConversationListResponse> {
    const conversations = await this.prisma.chatConversation.findMany({
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],

      include: {
        satellite: {
          select: { id: true, satelliteCode: true, satelliteName: true },
        },
      },
    });

    return {
      conversations: conversations.map((conversation) =>
        this.toSummary(conversation, 'admin'),
      ),
    };
  }

  /* =======================================================
     SUMMARY (single conversation, either viewer's perspective)
  ======================================================= */

  async getSummaryById(
    conversationId: string,
    viewer: 'admin' | 'satellite',
  ): Promise<ChatConversationSummary> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },

      include: {
        satellite: {
          select: { id: true, satelliteCode: true, satelliteName: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return this.toSummary(conversation, viewer);
  }

  /* =======================================================
     MESSAGE HISTORY
  ======================================================= */

  async getMessages(conversationId: string): Promise<ChatMessageResponse[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_MESSAGE_HISTORY,
    });

    return messages.map((message) => this.toMessageResponse(message));
  }

  /* =======================================================
     CREATE MESSAGE
  ======================================================= */

  async createMessage(
    input: CreateChatMessageInput,
  ): Promise<ChatMessageResponse> {
    const content = input.content.trim();

    if (!content && input.attachments.length === 0) {
      throw new BadRequestException(
        'A message requires content or an attachment.',
      );
    }

    const preview = (
      content || getAttachmentSummary(input.attachments.length)
    ).slice(0, MAX_PREVIEW_LENGTH);

    const senderRole =
      input.senderRole === 'admin'
        ? ChatSenderRole.ADMIN
        : ChatSenderRole.SATELLITE;

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: input.conversationId,
          senderRole,
          senderId: input.senderId,
          content,
          attachments:
            input.attachments.length > 0
              ? (input.attachments as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      }),

      this.prisma.chatConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview,

          ...(senderRole === ChatSenderRole.SATELLITE
            ? { adminUnreadCount: { increment: 1 } }
            : { satelliteUnreadCount: { increment: 1 } }),
        },
      }),
    ]);

    return this.toMessageResponse(message);
  }

  /* =======================================================
     MARK READ
  ======================================================= */

  async markRead(
    conversationId: string,
    readerRole: ChatSenderRoleParam,
  ): Promise<void> {
    const readerEnum =
      readerRole === 'admin' ? ChatSenderRole.ADMIN : ChatSenderRole.SATELLITE;

    const otherEnum =
      readerEnum === ChatSenderRole.ADMIN
        ? ChatSenderRole.SATELLITE
        : ChatSenderRole.ADMIN;

    await this.prisma.$transaction([
      this.prisma.chatMessage.updateMany({
        where: {
          conversationId,
          senderRole: otherEnum,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      }),

      this.prisma.chatConversation.update({
        where: { id: conversationId },
        data:
          readerEnum === ChatSenderRole.ADMIN
            ? { adminUnreadCount: 0 }
            : { satelliteUnreadCount: 0 },
      }),
    ]);
  }

  /* =======================================================
     MAPPERS
  ======================================================= */

  private toSummary(
    conversation: ConversationWithSatellite,
    viewer: 'admin' | 'satellite',
  ): ChatConversationSummary {
    return {
      id: conversation.id,
      satelliteId: conversation.satelliteId,
      satelliteCode: conversation.satellite.satelliteCode,
      satelliteName: conversation.satellite.satelliteName,
      lastMessage: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount:
        viewer === 'admin'
          ? conversation.adminUnreadCount
          : conversation.satelliteUnreadCount,
    };
  }

  private toMessageResponse(message: ChatMessage): ChatMessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderRole:
        message.senderRole === ChatSenderRole.ADMIN ? 'admin' : 'satellite',
      content: message.content,
      sentAt: message.createdAt.toISOString(),
      attachments: parseAttachments(message.attachments),
      edited: message.edited,
      deleted: message.deleted,
    };
  }
}

type ChatSenderRoleParam = 'admin' | 'satellite';

function parseAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as ChatAttachment[];
}

function getAttachmentSummary(count: number): string {
  if (count === 1) {
    return 'Sent an attachment';
  }

  return `Sent ${count} attachments`;
}
