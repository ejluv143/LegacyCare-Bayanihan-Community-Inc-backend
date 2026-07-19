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

function requireEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function getDatabasePort(): number {
  const rawPort =
    requireEnvironmentVariable(
      'DATABASE_PORT',
    );

  const port =
    Number.parseInt(rawPort, 10);

  if (
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      'DATABASE_PORT must be a valid port number.',
    );
  }

  return port;
}

function getDatabaseCaCertificate(): string {
  /*
   * Production/Vercel:
   *
   * Read the Aiven CA certificate from a
   * base64-encoded environment variable.
   */
  const base64Certificate =
    process.env
      .DATABASE_SSL_CA_BASE64
      ?.trim();

  if (base64Certificate) {
    const certificate =
      Buffer.from(
        base64Certificate,
        'base64',
      ).toString('utf8');

    if (
      !certificate.includes(
        '-----BEGIN CERTIFICATE-----',
      ) ||
      !certificate.includes(
        '-----END CERTIFICATE-----',
      )
    ) {
      throw new Error(
        'DATABASE_SSL_CA_BASE64 does not contain a valid CA certificate.',
      );
    }

    return certificate;
  }

  /*
   * Local development:
   *
   * Fall back to reading certs/ca.pem using
   * DATABASE_SSL_CA_PATH from the local .env.
   */
  const certificatePath =
    resolve(
      process.cwd(),
      requireEnvironmentVariable(
        'DATABASE_SSL_CA_PATH',
      ),
    );

  try {
    return readFileSync(
      certificatePath,
      'utf8',
    );
  } catch (error: unknown) {
    const reason =
      error instanceof Error
        ? error.message
        : 'Unknown file error';

    throw new Error(
      `Unable to read the database CA certificate at "${certificatePath}": ${reason}`,
    );
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements
    OnModuleInit,
    OnModuleDestroy
{
  constructor() {
    const adapter =
      new PrismaMariaDb({
        host:
          requireEnvironmentVariable(
            'DATABASE_HOST',
          ),

        port: getDatabasePort(),

        user:
          requireEnvironmentVariable(
            'DATABASE_USER',
          ),

        password:
          requireEnvironmentVariable(
            'DATABASE_PASSWORD',
          ),

        database:
          requireEnvironmentVariable(
            'DATABASE_NAME',
          ),

        /*
         * Keep the pool small because Vercel
         * can create several serverless instances.
         */
        connectionLimit: 5,

        ssl: {
          ca: getDatabaseCaCertificate(),
        },
      });

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}