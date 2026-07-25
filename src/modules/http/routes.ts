import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.js';
import type { CheckService } from '../checks/check.service.js';
import {
  historyQuery,
  idParams,
  productIdParams,
  productInput,
  productPatch,
  sourceInput,
  sourcePatch,
} from './schemas.js';

export function registerRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  checks: CheckService,
  env: Env,
): void {
  app.get('/health', { schema: { tags: ['system'] } }, async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }));
  app.get('/ready', { schema: { tags: ['system'] } }, async (_request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.post('/products', { schema: { tags: ['products'] } }, async (request, reply) => {
    const body = productInput.parse(request.body);
    return reply.code(201).send(await db.product.create({ data: body }));
  });
  app.get('/products', { schema: { tags: ['products'] } }, () =>
    db.product.findMany({ include: { _count: { select: { sources: true } } } }),
  );
  app.get('/products/:id', { schema: { tags: ['products'] } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const item = await db.product.findUnique({
      where: { id },
      include: { sources: true, alertRules: true },
    });
    return item ?? reply.code(404).send({ error: 'Product not found' });
  });
  app.patch('/products/:id', { schema: { tags: ['products'] } }, async (request) => {
    const { id } = idParams.parse(request.params);
    return db.product.update({ where: { id }, data: productPatch.parse(request.body) });
  });
  app.delete('/products/:id', { schema: { tags: ['products'] } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.product.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post(
    '/products/:productId/sources',
    { schema: { tags: ['sources'] } },
    async (request, reply) => {
      const { productId } = productIdParams.parse(request.params);
      const body = sourceInput.parse(request.body);
      return reply
        .code(201)
        .send(await db.productSource.create({ data: { ...body, productId } as any }));
    },
  );
  app.get('/products/:productId/sources', { schema: { tags: ['sources'] } }, (request) => {
    const { productId } = productIdParams.parse(request.params);
    return db.productSource.findMany({ where: { productId } });
  });
  app.patch('/sources/:id', { schema: { tags: ['sources'] } }, async (request) => {
    const { id } = idParams.parse(request.params);
    return db.productSource.update({
      where: { id },
      data: sourcePatch.parse(request.body) as any,
    });
  });
  app.delete('/sources/:id', { schema: { tags: ['sources'] } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.productSource.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post('/sources/:id/check', { schema: { tags: ['checks'] } }, async (request) => {
    const { id } = idParams.parse(request.params);
    return checks.checkSource(id);
  });
  app.post('/products/:id/check', { schema: { tags: ['checks'] } }, async (request) => {
    const { id } = idParams.parse(request.params);
    return checks.checkProduct(id);
  });
  app.post('/jobs/check-all', { schema: { tags: ['jobs'] } }, async (request, reply) => {
    if (!env.JOB_API_TOKEN) {
      return reply.code(503).send({ error: 'JOB_API_TOKEN is not configured' });
    }
    const authorization = request.headers.authorization;
    if (authorization !== `Bearer ${env.JOB_API_TOKEN}`) {
      return reply.code(401).send({ error: 'Invalid job token' });
    }
    return checks.checkAll();
  });

  app.get('/products/:id/checks', { schema: { tags: ['history'] } }, (request) => {
    const { id } = idParams.parse(request.params);
    const query = historyQuery.parse(request.query);
    return db.productCheck.findMany({
      where: {
        productSource: { productId: id, ...(query.store ? { storeName: query.store } : {}) },
        ...(query.status ? { status: query.status } : {}),
        ...(query.available === undefined ? {} : { available: query.available }),
        checkedAt: { gte: query.from, lte: query.to },
      },
      include: { productSource: { select: { storeName: true } } },
      orderBy: { checkedAt: 'desc' },
      take: query.limit,
    });
  });
  app.get('/sources/:id/checks', { schema: { tags: ['history'] } }, (request) => {
    const { id } = idParams.parse(request.params);
    const query = historyQuery.parse(request.query);
    return db.productCheck.findMany({
      where: {
        productSourceId: id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.available === undefined ? {} : { available: query.available }),
        checkedAt: { gte: query.from, lte: query.to },
      },
      orderBy: { checkedAt: 'desc' },
      take: query.limit,
    });
  });
  app.get('/products/:id/price-history', { schema: { tags: ['history'] } }, (request) => {
    const { id } = idParams.parse(request.params);
    const query = historyQuery.parse(request.query);
    return db.productCheck.findMany({
      where: {
        productSource: { productId: id, ...(query.store ? { storeName: query.store } : {}) },
        status: 'SUCCESS',
        price: { not: null },
        checkedAt: { gte: query.from, lte: query.to },
      },
      select: {
        checkedAt: true,
        price: true,
        currency: true,
        available: true,
        productSource: { select: { storeName: true } },
      },
      orderBy: { checkedAt: 'asc' },
      take: query.limit,
    });
  });

  app.get('/dashboard', { schema: { tags: ['dashboard'] } }, async () => {
    const products = await db.product.findMany({
      where: { enabled: true },
      include: {
        sources: {
          where: { enabled: true },
          include: { checks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
        },
      },
    });
    const recentErrors = await db.productCheck.findMany({
      where: { status: { not: 'SUCCESS' } },
      orderBy: { checkedAt: 'desc' },
      take: 10,
      include: { productSource: { select: { storeName: true, productId: true } } },
    });
    const alertsSent = await db.notificationEvent.count({ where: { status: 'SENT' } });
    return {
      monitoredProducts: products.length,
      enabledSources: products.reduce((count, product) => count + product.sources.length, 0),
      products: products.map((product) => {
        const latest = product.sources.flatMap((source) =>
          source.checks.map((check) => ({ ...check, storeName: source.storeName })),
        );
        const prices = latest.filter((item) => item.price).map((item) => Number(item.price));
        return {
          id: product.id,
          name: product.name,
          lastPrice: latest[0]?.price ?? null,
          bestCurrentPrice: prices.length ? Math.min(...prices) : null,
          available: latest.some((item) => item.available),
          lastCheck: latest.map((item) => item.checkedAt).sort().at(-1) ?? null,
        };
      }),
      recentErrors,
      alertsSent,
    };
  });
}
