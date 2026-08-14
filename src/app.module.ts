import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BeneficiaryModule } from './beneficiary/beneficiary.module';
import { CertificateModule } from './certificate/certificate.module';
import { ChatModule } from './chat/chat.module';
import { ClaimsModule } from './claims/claims.module';
import { DigitalIdModule } from './digital-id/digital-id.module';
import { MemberDashboardModule } from './member/member-dashboard.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SatelliteModule } from './satellite/satellite.module';
import { SatellitesModule } from './satellites/satellites.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    AdminModule,
    AnnouncementsModule,
    AuthModule,
    BeneficiaryModule,
    CertificateModule,
    ChatModule,
    ClaimsModule,
    MemberDashboardModule,
    DigitalIdModule,
    ProfileModule,
    NotificationsModule,
    SatelliteModule,
    SatellitesModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
