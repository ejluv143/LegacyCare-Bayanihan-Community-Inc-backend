import { Module } from "@nestjs/common";
import {
  ConfigModule,
  ConfigService,
} from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { DatabaseModule } from "../admin/database/database.module";
import { MembersModule } from "../members/members.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    ConfigModule,

    DatabaseModule,

    MembersModule,

    PassportModule.register({
      defaultStrategy: "jwt",
      session: false,
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ) => {
        const secret =
          configService.get<string>(
            "JWT_SECRET",
          );

        if (!secret) {
          throw new Error(
            "JWT_SECRET is missing from the backend environment.",
          );
        }

        return {
          secret,

          signOptions: {
            expiresIn: "1d",
          },
        };
      },
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
  ],
})
export class AuthModule {}