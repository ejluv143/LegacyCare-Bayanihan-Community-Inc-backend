/**
 * REST + realtime response shapes for the satellite <-> admin chat
 * feature. These mirror the frontend's `ChatSocketMessage` /
 * `ChatSocketAttachment` types in
 * app/src/lib/chat-socket-events.ts -- keep the two in sync if either
 * side changes.
 */

/* =========================================================
   SENDER ROLE
========================================================= */

export type ChatSenderRoleValue = 'admin' | 'satellite';

/* =========================================================
   ATTACHMENT
========================================================= */

export interface ChatAttachment {
  id: string;

  type: 'image' | 'file' | 'video' | 'audio';

  name: string;

  size: number;

  url: string;

  thumbnailUrl?: string | null;

  mimeType?: string | null;
}

/* =========================================================
   MESSAGE
========================================================= */

export interface ChatMessageResponse {
  id: string;

  conversationId: string;

  senderRole: ChatSenderRoleValue;

  content: string;

  sentAt: string;

  attachments: ChatAttachment[];

  edited: boolean;

  deleted: boolean;
}

/* =========================================================
   CONVERSATION SUMMARY
========================================================= */

export interface ChatConversationSummary {
  id: string;

  satelliteId: string;

  satelliteCode: string;

  satelliteName: string;

  lastMessage: string | null;

  lastMessageAt: string | null;

  // From the perspective of whoever asked -- an admin's list carries
  // adminUnreadCount per row, a satellite's carries its own.
  unreadCount: number;
}

/* =========================================================
   RESPONSES
========================================================= */

export interface ChatConversationDetailResponse {
  conversation: ChatConversationSummary;

  messages: ChatMessageResponse[];
}

export interface ChatConversationListResponse {
  conversations: ChatConversationSummary[];
}

/* =========================================================
   CREATE MESSAGE INPUT
========================================================= */

export interface CreateChatMessageInput {
  conversationId: string;

  senderRole: ChatSenderRoleValue;

  senderId: string;

  content: string;

  attachments: ChatAttachment[];
}
