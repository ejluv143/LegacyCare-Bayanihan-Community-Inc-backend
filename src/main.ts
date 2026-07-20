import 'dotenv/config';

import {
  INestApplication,
  ValidationPipe,
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

let serverPromise: Promise<HttpRequestHandler> | null =
  null;

function configureApplication(
  app: INestApplication,
): void {
  app.setGlobalPrefix('api');

  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://legacy-care-bayanihan-community-inc-omega.vercel.app',
    ].join(',')
  )
    .split(',')
    .map((origin) =>
      origin.trim().replace(/\/+$/, ''),
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
  const app = await NestFactory.create(AppModule);

  configureApplication(app);

  return app;
}

async function createServer(): Promise<HttpRequestHandler> {
  const app = await createApplication();

  await app.init();

  return app
    .getHttpAdapter()
    .getInstance() as HttpRequestHandler;
}

async function getServer(): Promise<HttpRequestHandler> {
  if (!serverPromise) {
    serverPromise = createServer().catch(
      (error: unknown) => {
        serverPromise = null;
        throw error;
      },
    );
  }

  return serverPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<unknown> {
  const server = await getServer();

  return server(request, response);
}

async function bootstrapLocal(): Promise<void> {
  const app = await createApplication();

  const parsedPort = Number.parseInt(
    process.env.PORT ?? '3001',
    10,
  );

  const port =
    Number.isInteger(parsedPort) && parsedPort > 0
      ? parsedPort
      : 3001;

  await app.listen(port, '0.0.0.0');

  console.log(
    `Legacy Care backend is running at http://localhost:${port}/api`,
  );
}

if (process.env.VERCEL !== '1') {
  bootstrapLocal().catch((error: unknown) => {
    console.error(
      'Unable to start the Legacy Care backend:',
      error,
    );

    process.exitCode = 1;
  });
}