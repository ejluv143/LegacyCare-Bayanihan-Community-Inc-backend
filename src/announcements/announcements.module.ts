import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { MemberAnnouncementsController } from './member-announcements.controller';
import { SatelliteAnnouncementsController } from './satellite-announcements.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    MemberAnnouncementsController,
    SatelliteAnnouncementsController,
    AdminAnnouncementsController,
  ],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
