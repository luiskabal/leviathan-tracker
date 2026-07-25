import type { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import type { Env } from '../../config/env.js';
import type { ScraperRegistry } from '../../providers/scrapers/registry.js';
import type {
  NotificationPayload,
  NotificationProvider,
} from '../../providers/notifications/types.js';
import { evaluateRule, outsideCooldown } from '../alerts/evaluator.js';

const activeUrls = new Map<string, Promise<unknown>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export class CheckService {
  private readonly limit: ReturnType<typeof pLimit>;
  constructor(
    private readonly db: PrismaClient,
    private readonly registry: ScraperRegistry,
    private readonly providers: NotificationProvider[],
    private readonly env: Env,
  ) {
    this.limit = pLimit(env.CHECK_CONCURRENCY);
  }

  checkSource(id: string) {
    return this.limit(async () => {
      const source = await this.db.productSource.findUnique({
        where: { id },
        include: { product: { include: { alertRules: true } } },
      });
      if (!source) throw new Error('Source not found');
      const existing = activeUrls.get(source.url);
      if (existing) return existing;
      const task = this.perform(source).finally(() => activeUrls.delete(source.url));
      activeUrls.set(source.url, task);
      return task;
    });
  }

  async checkProduct(productId: string) {
    const sources = await this.db.productSource.findMany({ where: { productId, enabled: true } });
    return Promise.all(sources.map(({ id }) => this.checkSource(id)));
  }

  async checkAll() {
    const sources = await this.db.productSource.findMany({
      where: { enabled: true, product: { enabled: true } },
      select: { id: true },
    });
    const results = await Promise.allSettled(sources.map(({ id }) => this.checkSource(id)));
    return {
      total: results.length,
      succeeded: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length,
    };
  }

  private async perform(source: any) {
    const previous = await this.db.productCheck.findFirst({
      where: { productSourceId: source.id, status: 'SUCCESS' },
      orderBy: { checkedAt: 'desc' },
    });
    const started = Date.now();
    try {
      let result;
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.env.CHECK_RETRIES; attempt++) {
        try {
          result = await this.registry.for(source).check(source);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < this.env.CHECK_RETRIES) await sleep(250 * 2 ** attempt);
        }
      }
      if (!result) throw lastError;
      const check = await this.db.productCheck.create({
        data: {
          productSourceId: source.id,
          status: 'SUCCESS',
          available: result.available,
          price: result.price,
          currency: result.currency,
          seller: result.seller,
          rawAvailability: result.rawAvailability,
          durationMs: Date.now() - started,
          contentHash: result.contentHash,
        },
      });
      await this.evaluateAndNotify(source, check, previous ?? undefined);
      return check;
    } catch (error) {
      const check = await this.db.productCheck.create({
        data: {
          productSourceId: source.id,
          status: safeError(error).includes('403') ? 'BLOCKED' : 'FAILED',
          errorMessage: safeError(error),
          durationMs: Date.now() - started,
        },
      });
      await this.evaluateAndNotify(source, check, previous ?? undefined);
      return check;
    }
  }

  private async evaluateAndNotify(source: any, current: any, previous?: any): Promise<void> {
    const failureCount =
      current.status === 'SUCCESS'
        ? 0
        : await this.db.productCheck.count({
            where: {
              productSourceId: source.id,
              status: { not: 'SUCCESS' },
              checkedAt: { gte: previous?.checkedAt ?? new Date(0) },
            },
          });
    for (const rule of source.product.alertRules.filter((item: any) => item.enabled)) {
      const matched = evaluateRule(
        {
          type: rule.type,
          targetValue: rule.targetValue ? Number(rule.targetValue) : undefined,
          failureCount,
          failureThreshold: this.env.CHECK_FAILURE_THRESHOLD,
        },
        { available: current.available, price: current.price ? Number(current.price) : undefined },
        previous
          ? { available: previous.available, price: previous.price ? Number(previous.price) : undefined }
          : undefined,
      );
      if (!matched) continue;
      const channels = await this.db.notificationChannel.findMany({ where: { enabled: true } });
      for (const channel of channels) {
        const last = await this.db.notificationEvent.findFirst({
          where: {
            alertRuleId: rule.id,
            productSourceId: source.id,
            channelId: channel.id,
            status: 'SENT',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!outsideCooldown(last?.sentAt ?? undefined, rule.cooldownMinutes)) continue;
        const message = `${source.product.name} · ${source.storeName} · ${rule.type}`;
        const event = await this.db.notificationEvent.create({
          data: {
            productId: source.productId,
            productSourceId: source.id,
            alertRuleId: rule.id,
            channelId: channel.id,
            status: 'PENDING',
            message,
          },
        });
        const provider = this.providers.find((item) => item.supports(channel));
        if (!provider) {
          await this.db.notificationEvent.update({
            where: { id: event.id },
            data: { status: 'SKIPPED', errorMessage: `${channel.type} adapter is not implemented` },
          });
          continue;
        }
        const payload: NotificationPayload = {
          title: 'LEVIATHAN TRACKER',
          message,
          url: source.url,
          fields: [
            { name: 'Producto', value: source.product.name, inline: true },
            { name: 'Modelo', value: source.product.model, inline: true },
            { name: 'Tienda', value: source.storeName, inline: true },
            { name: 'Disponible', value: current.available ? 'SÍ' : 'NO', inline: true },
            {
              name: 'Precio',
              value: current.price ? `${current.currency} ${current.price}` : 'No detectado',
              inline: true,
            },
          ],
        };
        try {
          await provider.send(channel, payload);
          await this.db.notificationEvent.update({
            where: { id: event.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } catch (error) {
          await this.db.notificationEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', errorMessage: safeError(error) },
          });
        }
      }
    }
  }
}
