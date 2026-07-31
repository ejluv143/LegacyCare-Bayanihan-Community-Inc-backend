import {
  Module,
} from '@nestjs/common';

import {
  PrismaModule,
} from '../admin/database/prisma/prisma.module';

import {
  ProfileController,
} from './profile.controller';

import {
  ProfileService,
} from './profile.service';

/* =========================================================
   PROFILE MODULE
========================================================= */

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    ProfileController,
  ],

  providers: [
    ProfileService,
  ],

  exports: [
    ProfileService,
  ],
})
export class ProfileModule {}