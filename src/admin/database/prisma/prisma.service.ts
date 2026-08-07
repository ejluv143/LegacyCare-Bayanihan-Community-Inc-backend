import 'dotenv/config';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient } from '../../../generated/prisma/client';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getDatabasePort(): number {
  const rawPort = requireEnvironmentVariable('DATABASE_PORT');

  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('DATABASE_PORT must be a valid port number.');
  }

  return port;
}

function getDatabaseCaCertificate(): string {
  /*
   * Production/Vercel:
   * Read the Base64-encoded Aiven CA
   * certificate from the environment.
   */
  const base64Certificate = process.env.DATABASE_SSL_CA_BASE64?.trim();

  if (base64Certificate) {
    let certificate: string;

    try {
      certificate = Buffer.from(base64Certificate, 'base64').toString('utf8');
    } catch {
      throw new Error('DATABASE_SSL_CA_BASE64 could not be decoded.');
    }

    if (
      !certificate.includes('-----BEGIN CERTIFICATE-----') ||
      !certificate.includes('-----END CERTIFICATE-----')
    ) {
      throw new Error(
        'DATABASE_SSL_CA_BASE64 does not contain a valid CA certificate.',
      );
    }

    return certificate;
  }

  /*
   * Local development:
   * Read the CA certificate using the
   * DATABASE_SSL_CA_PATH environment variable.
   */
  const certificatePath = resolve(
    process.cwd(),
    requireEnvironmentVariable('DATABASE_SSL_CA_PATH'),
  );

  try {
    const certificate = readFileSync(certificatePath, 'utf8');

    if (
      !certificate.includes('-----BEGIN CERTIFICATE-----') ||
      !certificate.includes('-----END CERTIFICATE-----')
    ) {
      throw new Error('The certificate file is not a valid PEM certificate.');
    }

    return certificate;
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? error.message : 'Unknown file error';

    throw new Error(
      `Unable to read the database CA certificate at "${certificatePath}": ${reason}`,
    );
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaMariaDb({
      host: requireEnvironmentVariable('DATABASE_HOST'),

      port: getDatabasePort(),

      user: requireEnvironmentVariable('DATABASE_USER'),

      password: requireEnvironmentVariable('DATABASE_PASSWORD'),

      database: requireEnvironmentVariable('DATABASE_NAME'),

      /*
       * Keep the connection pool small because
       * every serverless function instance may
       * create its own pool.
       */
      connectionLimit: 1,

      /*
       * Allow additional time for the remote
       * Aiven database connection.
       */
      connectTimeout: 20_000,
      acquireTimeout: 30_000,

      ssl: {
        ca: getDatabaseCaCertificate(),

        rejectUnauthorized: true,
      },
    });

    super({
      adapter,

      log:
        process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
