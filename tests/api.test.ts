import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';

const env: Env = {
  DATABASE_URL: 'postgresql://unused',
  PORT: 3000,
  HOST: '127.0.0.1',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  SCHEDULER_ENABLED: false,
  CHECK_CRON: '*/30 * * * *',
  CHECK_CONCURRENCY: 1,
  CHECK_TIMEOUT_MS: 1000,
  CHECK_RETRIES: 0,
  CHECK_FAILURE_THRESHOLD: 3,
  JOB_API_TOKEN: '1234567890123456',
  DISCORD_WEBHOOK_URL: '',
  USER_AGENT: 'test',
};
const apps: Array<Awaited<ReturnType<typeof buildApp>>['app']> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('API', () => {
  it('serves health and protects the job', async () => {
    const db = { productSource: { findMany: vi.fn().mockResolvedValue([]) } } as any;
    const { app } = await buildApp({ env, db });
    apps.push(app);
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/jobs/check-all' })).statusCode).toBe(401);
    const response = await app.inject({
      method: 'POST',
      url: '/jobs/check-all',
      headers: { authorization: `Bearer ${env.JOB_API_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ total: 0, succeeded: 0, failed: 0 });
  }, 30_000);
});
