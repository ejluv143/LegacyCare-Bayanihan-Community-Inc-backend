import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ConfigService,
} from "@nestjs/config";

import { JwtModule } from "@nestjs/jwt";

import { PrismaService } from "../admin/database/prisma/prisma.service";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    ConfigModule,

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

  controllers: [AuthController],

  providers: [
    AuthService,
    PrismaService,
  ],

  exports: [
    AuthService,
    JwtModule,
  ],
})
export class AuthModule {}