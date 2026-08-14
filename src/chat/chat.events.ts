/**
 * Socket.IO event contract for the satellite <-> admin chat gateway.
 * Mirrors app/src/lib/chat-socket-events.ts on the frontend exactly --
 * the event names/payload shapes here are what that file documents.
 * If either side changes an event name or payload, update both.
 */

export const CHAT_SOCKET_EVENTS = {
  SEND_MESSAGE: 'chat:message:send',
  MESSAGE_NEW: 'chat:message:new',
  MESSAGE_ACK: 'chat:message:ack',
  READ: 'chat:read',
  TYPING: 'chat:typing',
  PRESENCE: 'chat:presence',
} as const;

/* =========================================================
   CLIENT -> SERVER PAYLOADS
========================================================= */

export interface ChatSendMessagePayload {
  conversationId: string;

  clientMessageId: string;

  content: string;

  attachments?: Array<{
    id: string;
    type: 'image' | 'file' | 'video' | 'audio';
    name: string;
    size: number;
    url: string;
    thumbnailUrl?: string | null;
    mimeType?: string | null;
  }>;
}

export interface ChatReadPayload {
  conversationId: string;
}

export interface ChatTypingPayload {
  conversationId: string;

  isTyping: boolean;
}
