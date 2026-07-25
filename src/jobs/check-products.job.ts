import cron, { type ScheduledTask } from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';
import type { CheckService } from '../modules/checks/check.service.js';

export function startScheduler(
  checks: CheckService,
  env: Env,
  logger: FastifyBaseLogger,
): ScheduledTask | undefined {
  if (!env.SCHEDULER_ENABLED) return undefined;
  return cron.schedule(env.CHECK_CRON, () => {
    void checks
      .checkAll()
      .then((result) => logger.info({ result }, 'Scheduled product check completed'))
      .catch((error) => logger.error({ err: error }, 'Scheduled product check failed'));
  });
}
