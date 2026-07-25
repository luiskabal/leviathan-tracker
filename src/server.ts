import { buildApp } from './app.js';
import { startScheduler } from './jobs/check-products.job.js';

const { app, checks, env, db } = await buildApp();
const scheduler = startScheduler(checks, env, app.log);

const shutdown = async () => {
  scheduler?.stop();
  await app.close();
  await db.$disconnect();
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.fatal(error);
  process.exitCode = 1;
}
