import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type { Server, Socket } from 'socket.io';

import { getAllowedOrigins, normalizeOrigin } from '../common/allowed-origins';

import type {
  AuthenticatedUser,
  JwtPayload,
} from '../auth/strategies/jwt.strategy';

import { ADMIN_SENDER_ID, ChatService } from './chat.service';

import {
  CHAT_SOCKET_EVENTS,
  type ChatReadPayload,
  type ChatSendMessagePayload,
  type ChatTypingPayload,
} from './chat.events';

/**
 * Realtime counterpart to ChatController. Implements the contract
 * documented in chat.events.ts (which mirrors
 * app/src/lib/chat-socket-events.ts on the frontend).
 *
 * IMPORTANT: this only works when the Nest app is running as a
 * persistent process (`npm run start:dev` / `start:prod`, i.e.
 * bootstrapLocal in main.ts). Vercel's serverless request handler is
 * torn down between requests and can't hold a WebSocket connection
 * open, so this gateway is inert in the current Vercel deployment --
 * see the comment on `app.useWebSocketAdapter` in main.ts.
 *
 * Presence/room membership is tracked in this class's own memory, so
 * it's only correct for a single running instance. Scaling this
 * backend horizontally would need a shared Socket.IO adapter (e.g.
 * @socket.io/redis-adapter) so every instance sees the same rooms
 * and presence state.
 */
@WebSocketGateway({
  path: '/socket.io',

  cors: {
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

      if (getAllowedOrigins().includes(normalizedRequestOrigin)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `Origin "${normalizedRequestOrigin}" is not allowed by CORS.`,
        ),
        false,
      );
    },

    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly adminSockets = new Set<Socket>();

  private readonly satelliteSocketsByConversation = new Map<
    string,
    Set<Socket>
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  /* =======================================================
     AUTH MIDDLEWARE
  ======================================================= */

  afterInit(server: Server): void {
    server.use((socket: Socket, next: (error?: Error) => void) => {
      this.authenticateSocket(socket).then(
        (user) => {
          getSocketData(socket).user = user;
          next();
        },
        (error: unknown) => {
          next(
            error instanceof Error
              ? error
              : new Error('Chat authentication failed.'),
          );
        },
      );
    });
  }

  private async authenticateSocket(socket: Socket): Promise<AuthenticatedUser> {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token || !token.trim()) {
      throw new Error('Missing authentication token.');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token.trim());

    if (
      payload.accountType !== 'admin' &&
      payload.accountType !== 'satellite'
    ) {
      throw new Error('Only admin and satellite accounts can use chat.');
    }

    return {
      sub: payload.sub,
      satelliteId: payload.satelliteId,
      satelliteCode: payload.satelliteCode,
      username: payload.username,
      role: payload.role,
      accountType: payload.accountType,
    };
  }

  /* =======================================================
     CONNECTION
  ======================================================= */

  async handleConnection(socket: Socket): Promise<void> {
    const user = getSocketData(socket).user;

    // Should always be set -- the auth middleware in afterInit()
    // rejects the handshake before `connection` fires otherwise.
    if (!user) {
      socket.disconnect(true);
      return;
    }

    if (user.accountType === 'admin') {
      this.adminSockets.add(socket);
      await this.joinAdminToAllConversations(socket);
      this.broadcastAdminPresence(true);
      return;
    }

    if (!user.satelliteId) {
      socket.disconnect(true);
      return;
    }

    const conversation =
      await this.chatService.getOrCreateConversationForSatellite(
        user.satelliteId,
      );

    getSocketData(socket).conversationId = conversation.id;

    const room = conversationRoom(conversation.id);

    await socket.join(room);

    this.trackSatelliteSocket(conversation.id, socket);

    // The conversation may have just been created above -- make sure
    // every connected admin socket is in its room too.
    this.ensureAdminsJoined(room);

    this.broadcastPresence(room, {
      contactId: user.satelliteId,
      online: true,
    });

    if (this.adminSockets.size > 0) {
      socket.emit(CHAT_SOCKET_EVENTS.PRESENCE, {
        contactId: ADMIN_SENDER_ID,
        online: true,
      });
    }
  }

  /* =======================================================
     DISCONNECTION
  ======================================================= */

  handleDisconnect(socket: Socket): void {
    const user = getSocketData(socket).user;

    if (!user) {
      return;
    }

    if (user.accountType === 'admin') {
      this.adminSockets.delete(socket);

      if (this.adminSockets.size === 0) {
        this.broadcastAdminPresence(false);
      }

      return;
    }

    const conversationId = getSocketData(socket).conversationId;

    if (!conversationId || !user.satelliteId) {
      return;
    }

    const sockets = this.satelliteSocketsByConversation.get(conversationId);

    sockets?.delete(socket);

    if (!sockets || sockets.size === 0) {
      this.satelliteSocketsByConversation.delete(conversationId);

      this.broadcastPresence(conversationRoom(conversationId), {
        contactId: user.satelliteId,
        online: false,
      });
    }
  }

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  @SubscribeMessage(CHAT_SOCKET_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: ChatSendMessagePayload,
  ): Promise<void> {
    const user = getSocketData(socket).user;

    if (!user || !payload?.conversationId || !payload.clientMessageId) {
      return;
    }

    const conversationId = await this.resolveConversationId(
      socket,
      user,
      payload.conversationId,
    );

    if (!conversationId) {
      return;
    }

    const senderRole = user.accountType === 'admin' ? 'admin' : 'satellite';
    const senderId = user.accountType === 'admin' ? ADMIN_SENDER_ID : user.sub;

    let message;

    try {
      message = await this.chatService.createMessage({
        conversationId,
        senderRole,
        senderId,
        content: payload.content ?? '',
        attachments: payload.attachments ?? [],
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Rejected chat message in ${conversationId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      return;
    }

    // Acked to the sender only; every other socket already in the
    // room (the other party, or another tab on the same side) gets
    // the broadcast below instead.
    socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_ACK, {
      conversationId,
      clientMessageId: payload.clientMessageId,
      message,
    });

    socket
      .to(conversationRoom(conversationId))
      .emit(CHAT_SOCKET_EVENTS.MESSAGE_NEW, { conversationId, message });
  }

  /* =======================================================
     READ
  ======================================================= */

  @SubscribeMessage(CHAT_SOCKET_EVENTS.READ)
  async handleRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: ChatReadPayload,
  ): Promise<void> {
    const user = getSocketData(socket).user;

    if (!user || !payload?.conversationId) {
      return;
    }

    const conversationId = await this.resolveConversationId(
      socket,
      user,
      payload.conversationId,
    );

    if (!conversationId) {
      return;
    }

    await this.chatService.markRead(
      conversationId,
      user.accountType === 'admin' ? 'admin' : 'satellite',
    );

    socket.to(conversationRoom(conversationId)).emit(CHAT_SOCKET_EVENTS.READ, {
      conversationId,
      readAt: new Date().toISOString(),
    });
  }

  /* =======================================================
     TYPING
  ======================================================= */

  @SubscribeMessage(CHAT_SOCKET_EVENTS.TYPING)
  async handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: ChatTypingPayload,
  ): Promise<void> {
    const user = getSocketData(socket).user;

    if (!user || !payload?.conversationId) {
      return;
    }

    const conversationId = await this.resolveConversationId(
      socket,
      user,
      payload.conversationId,
    );

    if (!conversationId) {
      return;
    }

    socket
      .to(conversationRoom(conversationId))
      .emit(CHAT_SOCKET_EVENTS.TYPING, {
        conversationId,
        isTyping: Boolean(payload.isTyping),
      });
  }

  /* =======================================================
     HELPERS
  ======================================================= */

  // A satellite can only ever act on its own conversation, no matter
  // what conversationId it sends -- this is what stops one satellite
  // from reading/writing another's chat. Admin may target any
  // conversation that actually exists.
  private async resolveConversationId(
    socket: Socket,
    user: AuthenticatedUser,
    requestedConversationId: string,
  ): Promise<string | null> {
    if (user.accountType === 'satellite') {
      return getSocketData(socket).conversationId ?? null;
    }

    try {
      const conversation = await this.chatService.getConversationById(
        requestedConversationId,
      );

      await socket.join(conversationRoom(conversation.id));

      return conversation.id;
    } catch {
      return null;
    }
  }

  private async joinAdminToAllConversations(socket: Socket): Promise<void> {
    const { conversations } =
      await this.chatService.listConversationsForAdmin();

    // socket.join() is synchronous (it just adds the id to an
    // in-memory room set) -- no Promise.all needed here.
    for (const conversation of conversations) {
      void socket.join(conversationRoom(conversation.id));
    }
  }

  private ensureAdminsJoined(room: string): void {
    for (const adminSocket of this.adminSockets) {
      void adminSocket.join(room);
    }
  }

  private trackSatelliteSocket(conversationId: string, socket: Socket): void {
    const sockets =
      this.satelliteSocketsByConversation.get(conversationId) ??
      new Set<Socket>();

    sockets.add(socket);

    this.satelliteSocketsByConversation.set(conversationId, sockets);
  }

  private broadcastPresence(
    room: string,
    payload: { contactId: string; online: boolean },
  ): void {
    this.server.to(room).emit(CHAT_SOCKET_EVENTS.PRESENCE, payload);
  }

  private broadcastAdminPresence(online: boolean): void {
    for (const conversationId of this.satelliteSocketsByConversation.keys()) {
      this.broadcastPresence(conversationRoom(conversationId), {
        contactId: ADMIN_SENDER_ID,
        online,
      });
    }
  }
}

/* =========================================================
   SOCKET DATA
========================================================= */

interface ChatSocketData {
  user?: AuthenticatedUser;

  // Only set for satellite sockets, once resolved on connect.
  conversationId?: string;
}

function getSocketData(socket: Socket): ChatSocketData {
  return socket.data as ChatSocketData;
}

function conversationRoom(conversationId: string): string {
  return `chat:${conversationId}`;
}
