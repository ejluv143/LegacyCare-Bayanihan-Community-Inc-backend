import { Module } from '@nestjs/common';

import { AnnouncementsModule } from '../announcements/announcements.module';
import { DatabaseModule } from '../admin/database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SatelliteNotificationsController } from './satellite-notifications.controller';

@Module({
  imports: [DatabaseModule, AnnouncementsModule],
  controllers: [NotificationsController, SatelliteNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
