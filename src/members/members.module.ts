import { Module } from '@nestjs/common';

import { DatabaseModule } from '../admin/database/database.module';
import { MembersService } from './members.service';

@Module({
  imports: [DatabaseModule],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
