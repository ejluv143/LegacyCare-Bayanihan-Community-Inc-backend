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

function configureApplication(
  app: INestApplication,
): void {
  app.setGlobalPrefix('api');

  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    'legacy-care-bayanihan-community-inc-omega.vercel.app'
  )
    .split(',')
    .map((origin) =>
      origin.trim().replace(/\/$/, ''),
    )
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

async function createApplication(): Promise<INestApplication> {
  const app =
    await NestFactory.create(AppModule);

  configureApplication(app);

  return app;
}

/*
 * Creates and initializes the NestJS application
 * without opening a permanent TCP port.
 *
 * Vercel will call the exported handler instead.
 */
async function createServer(): Promise<HttpRequestHandler> {
  const app =
    await createApplication();

  await app.init();

  return app
  .getHttpAdapter()
  .getInstance() as HttpRequestHandler;
}

/*
 * Cache the initialized NestJS server so warm
 * Vercel invocations reuse the same application.
 */
async function getServer(): Promise<HttpRequestHandler> {
  if (!serverPromise) {
    serverPromise =
      createServer().catch(
        (error: unknown) => {
          serverPromise = null;
          throw error;
        },
      );
  }

  return serverPromise;
}

/*
 * Vercel serverless function entry point.
 *
 * Export both a named handler and a default
 * handler so Vercel can detect the function.
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

/*
 * Local development entry point.
 *
 * Vercel automatically provides VERCEL=1,
 * so this listener only runs locally.
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
    Number.isInteger(configuredPort) &&
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