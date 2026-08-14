/**
 * Shared frontend-origin allowlist, used by both the REST CORS setup
 * in main.ts and the chat WebSocket gateway's CORS setup -- kept
 * here instead of in main.ts so the gateway (which app.module.ts
 * pulls in) doesn't have to import the application entrypoint.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://legacy-care-bayanihan-community-inc-omega.vercel.app',
];

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.FRONTEND_URLS,
    process.env.FRONTEND_URL,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .flatMap((value) => value.split(','))
    .map(normalizeOrigin)
    .filter(Boolean);

  return Array.from(
    new Set([
      ...DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin),
      ...configuredOrigins,
    ]),
  );
}
