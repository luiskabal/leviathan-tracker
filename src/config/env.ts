import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SCHEDULER_ENABLED: bool,
  CHECK_CRON: z.string().default('*/30 * * * *'),
  CHECK_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  CHECK_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
  CHECK_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  CHECK_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(3),
  JOB_API_TOKEN: z.string().min(16).optional().or(z.literal('')),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  USER_AGENT: z.string().default('LeviathanTracker/1.0'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
