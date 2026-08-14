import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { AuthModule } from '../auth/auth.module';

import { AdminChatController } from './admin-chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SatelliteChatController } from './satellite-chat.controller';

@Module({
  // AuthModule is imported (rather than just its guards) because
  // ChatGateway needs JwtService directly to verify the token a
  // socket connects with -- there's no HTTP request for a Nest guard
  // to attach to during a WebSocket handshake.
  imports: [DatabaseModule, AuthModule],

  controllers: [SatelliteChatController, AdminChatController],

  providers: [ChatService, ChatGateway],

  exports: [ChatService],
})
export class ChatModule {}
