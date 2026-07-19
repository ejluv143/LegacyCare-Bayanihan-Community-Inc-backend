import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';

import type {
  INestApplication,
} from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http';

import { AppModule } from './app.module';

type HttpRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => unknown;

let serverPromise:
  | Promise<HttpRequestHandler>
  | null = null;

/**
 * Configure shared NestJS application settings
 * for both local development and Vercel.
 */
function configureApplication(
  app: INestApplication,
): void {
  app.setGlobalPrefix('api');

  /**
   * FRONTEND_URLS supports multiple origins
   * separated by commas.
   *
   * Example:
   * http://localhost:3000,https://example.vercel.app
   */
  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://legacy-care-bayanihan-community-inc-omega.vercel.app/',
    ].join(',')
  )
    .split(',')
    .map((origin) =>
      origin
        .trim()
        .replace(/\/$/, ''),
    )
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,

    /**
     * Allows authorization headers and
     * credentialed browser requests.
     */
    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Accept',
      'Content-Type',
      'Authorization',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      /**
       * Remove request properties that are
       * not declared in the DTO.
       */
      whitelist: true,

      /**
       * Reject requests containing unknown
       * properties instead of silently removing them.
       */
      forbidNonWhitelisted: true,

      /**
       * Transform incoming request values
       * according to their DTO types.
       */
      transform: true,
    }),
  );
}

/**
 * Create and configure the NestJS application.
 */
async function createApplication(): Promise<INestApplication> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  configureApplication(app);

  return app;
}

/**
 * Initialize NestJS without opening a permanent
 * TCP listener.
 *
 * Vercel invokes the exported request handler.
 */
async function createServer(): Promise<HttpRequestHandler> {
  const app =
    await createApplication();

  await app.init();

  return app
    .getHttpAdapter()
    .getInstance() as HttpRequestHandler;
}

/**
 * Cache the initialized application so that
 * warm Vercel invocations reuse the same server.
 */
async function getServer(): Promise<HttpRequestHandler> {
  if (!serverPromise) {
    serverPromise =
      createServer().catch(
        (error: unknown) => {
          /**
           * Clear the cached promise when startup
           * fails so another request can retry.
           */
          serverPromise = null;

          throw error;
        },
      );
  }

  return serverPromise;
}

/**
 * Vercel serverless function entry point.
 */
export async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<unknown> {
  const server =
    await getServer();

  return server(
    request,
    response,
  );
}

export default handler;

/**
 * Start a normal HTTP listener during
 * local development.
 */
async function bootstrapLocal(): Promise<void> {
  const app =
    await createApplication();

  const configuredPort =
    Number.parseInt(
      process.env.PORT ?? '3001',
      10,
    );

  const port =
    Number.isInteger(
      configuredPort,
    ) &&
    configuredPort > 0
      ? configuredPort
      : 3001;

  await app.listen(
    port,
    '0.0.0.0',
  );

 console.log(
  `Legacy Care backend is running at http://localhost:${port}/api`,
);
}

/**
 * Vercel automatically provides VERCEL=1.
 * Therefore, the local listener will not run
 * inside a Vercel Function.
 */
if (process.env.VERCEL !== '1') {
  bootstrapLocal().catch(
    (error: unknown) => {
      console.error(
        'Unable to start the Legacy Care backend:',
        error,
      );

      process.exitCode = 1;
    },
  );
}