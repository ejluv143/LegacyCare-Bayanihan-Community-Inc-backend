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

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://legacy-care-bayanihan-community-inc-omega.vercel.app',
];

let serverPromise: Promise<HttpRequestHandler> | null =
  null;

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.FRONTEND_URLS,
    process.env.FRONTEND_URL,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0,
    )
    .flatMap((value) => value.split(','))
    .map(normalizeOrigin)
    .filter(Boolean);

  return Array.from(
    new Set([
      ...DEFAULT_ALLOWED_ORIGINS.map(
        normalizeOrigin,
      ),
      ...configuredOrigins,
    ]),
  );
}

function configureApplication(
  app: INestApplication,
): void {
  app.setGlobalPrefix('api');

  const allowedOrigins =
    getAllowedOrigins();

  app.enableCors({
    origin: (
      requestOrigin:
        | string
        | undefined,
      callback: (
        error: Error | null,
        allow?: boolean,
      ) => void,
    ) => {
      /*
       * Requests from PowerShell, Postman,
       * mobile apps, and server-to-server clients
       * may not include an Origin header.
       */
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      const normalizedRequestOrigin =
        normalizeOrigin(requestOrigin);

      const isAllowed =
        allowedOrigins.includes(
          normalizedRequestOrigin,
        );

      if (isAllowed) {
        callback(null, true);
        return;
      }

      console.warn(
        `Blocked CORS origin: ${normalizedRequestOrigin}`,
      );

      callback(
        new Error(
          `Origin "${normalizedRequestOrigin}" is not allowed by CORS.`,
        ),
        false,
      );
    },

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

    exposedHeaders: [
      'Content-Type',
    ],

    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}

async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule,
    {
      /*
       * Keep Nest logs enabled in Vercel
       * so production errors appear in Logs.
       */
      logger: [
        'error',
        'warn',
        'log',
      ],
    },
  );

  configureApplication(app);

  return app;
}

async function createServer(): Promise<HttpRequestHandler> {
  const app = await createApplication();

  /*
   * Initialize Nest without opening a port.
   * Vercel invokes the returned HTTP handler.
   */
  await app.init();

  const httpAdapter =
    app.getHttpAdapter();

  return httpAdapter.getInstance() as HttpRequestHandler;
}

async function getServer(): Promise<HttpRequestHandler> {
  if (!serverPromise) {
    serverPromise = createServer().catch(
      (error: unknown) => {
        /*
         * Clear the cached promise so a later
         * invocation can retry initialization.
         */
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
  try {
    const server = await getServer();

    return server(request, response);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown server initialization error';

    console.error(
      'Vercel request handler failed:',
      error,
    );

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader(
        'Content-Type',
        'application/json; charset=utf-8',
      );

      response.end(
        JSON.stringify({
          statusCode: 500,
          message:
            'Internal server error',
          error:
            process.env.NODE_ENV ===
            'development'
              ? message
              : undefined,
        }),
      );
    }

    return undefined;
  }
}

function getLocalPort(): number {
  const parsedPort =
    Number.parseInt(
      process.env.PORT ?? '3001',
      10,
    );

  if (
    Number.isInteger(parsedPort) &&
    parsedPort > 0 &&
    parsedPort <= 65535
  ) {
    return parsedPort;
  }

  return 3001;
}

async function bootstrapLocal(): Promise<void> {
  const app = await createApplication();
  const port = getLocalPort();

  await app.listen(
    port,
    '0.0.0.0',
  );

  console.log(
    `Legacy Care backend is running at http://localhost:${port}/api`,
  );

  console.log(
    'Allowed frontend origins:',
    getAllowedOrigins(),
  );
}

/*
 * Vercel sets VERCEL=1.
 * Only open a local listening port when the app
 * is running outside Vercel.
 */
if (process.env.VERCEL !== '1') {
  void bootstrapLocal().catch(
    (error: unknown) => {
      console.error(
        'Unable to start the Legacy Care backend:',
        error,
      );

      process.exitCode = 1;
    },
  );
}