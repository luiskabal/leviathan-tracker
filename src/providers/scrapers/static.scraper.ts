import type { ProductSource } from '@prisma/client';
import type { Env } from '../../config/env.js';
import { assertPublicDestination } from '../../shared/utils/url.js';
import { extractProduct } from './extract.js';
import type { ProductScraper, ScrapeResult } from './types.js';

export class GenericStaticScraper implements ProductScraper {
  constructor(private readonly env: Env) {}
  canHandle(source: ProductSource): boolean {
    return source.scraperType === 'STATIC';
  }
  async check(source: ProductSource): Promise<ScrapeResult> {
    await assertPublicDestination(source.url);
    const response = await fetch(source.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(this.env.CHECK_TIMEOUT_MS),
      headers: { 'user-agent': this.env.USER_AGENT, accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`Remote server returned HTTP ${response.status}`);
    return extractProduct(await response.text(), source);
  }
}
