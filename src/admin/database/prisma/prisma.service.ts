import 'dotenv/config';
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../../../generated/prisma/client';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const port = Number(requireEnvironmentVariable('DATABASE_PORT'));

    if (!Number.isInteger(port)) {
      throw new Error('DATABASE_PORT must be a valid number');
    }

    const certificatePath = resolve(
      process.cwd(),
      requireEnvironmentVariable('DATABASE_SSL_CA_PATH'),
    );

    const adapter = new PrismaMariaDb({
      host: requireEnvironmentVariable('DATABASE_HOST'),
      port,
      user: requireEnvironmentVariable('DATABASE_USER'),
      password: requireEnvironmentVariable('DATABASE_PASSWORD'),
      database: requireEnvironmentVariable('DATABASE_NAME'),
      connectionLimit: 5,
      ssl: {
        ca: readFileSync(certificatePath, 'utf8'),
      },
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}