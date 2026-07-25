import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { ZodError } from 'zod';
import { loadEnv, type Env } from './config/env.js';
import { CheckService } from './modules/checks/check.service.js';
import { registerRoutes } from './modules/http/routes.js';
import { DiscordProvider, WebhookProvider } from './providers/notifications/http.providers.js';
import { GenericPlaywrightScraper } from './providers/scrapers/playwright.scraper.js';
import { ScraperRegistry } from './providers/scrapers/registry.js';
import { GenericStaticScraper } from './providers/scrapers/static.scraper.js';
import { AppError } from './shared/errors.js';
import { prisma } from './shared/prisma.js';

export async function buildApp(options: { env?: Env; db?: typeof prisma } = {}) {
  const env = options.env ?? loadEnv();
  const db = options.db ?? prisma;
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: ['req.headers.authorization', '*.configuration.url'] },
    genReqId: (request) => String(request.headers['x-request-id'] ?? crypto.randomUUID()),
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Leviathan Tracker API', version: '1.0.0' },
      tags: [
        { name: 'products' },
        { name: 'sources' },
        { name: 'checks' },
        { name: 'history' },
      ],
    },
  });
  app.get('/docs/json', { schema: { hide: true } }, () => app.swagger());
  app.get('/docs', { schema: { hide: true } }, (_request, reply) =>
    reply.type('text/html').send(`<!doctype html>
<html><head><title>Leviathan Tracker API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/docs/json",dom_id:"#swagger-ui"});</script></body></html>`),
  );
  const registry = new ScraperRegistry([
    new GenericStaticScraper(env),
    new GenericPlaywrightScraper(env),
  ]);
  const checks = new CheckService(
    db,
    registry,
    [new DiscordProvider(), new WebhookProvider()],
    env,
  );
  registerRoutes(app, db, checks, env);
  app.setErrorHandler((error, request, reply) => {
    const appError = error as Error & { statusCode?: number; code?: string };
    request.log.warn({ err: error }, 'Request failed');
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'Validation failed', issues: error.issues });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    }
    if (appError.code === 'P2025') {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    return reply.code(appError.statusCode ?? 500).send({
      error: appError.statusCode ? appError.message : 'Internal server error',
    });
  });
  return { app, checks, env, db };
}
