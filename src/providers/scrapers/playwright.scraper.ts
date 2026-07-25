import type { ProductSource } from '@prisma/client';
import { chromium } from 'playwright';
import type { Env } from '../../config/env.js';
import { assertPublicDestination } from '../../shared/utils/url.js';
import { extractProduct } from './extract.js';
import type { ProductScraper, ScrapeResult } from './types.js';

export class GenericPlaywrightScraper implements ProductScraper {
  constructor(private readonly env: Env) {}
  canHandle(source: ProductSource): boolean {
    return source.scraperType === 'PLAYWRIGHT';
  }
  async check(source: ProductSource): Promise<ScrapeResult> {
    await assertPublicDestination(source.url);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: this.env.USER_AGENT });
      const page = await context.newPage();
      await page.goto(source.url, {
        waitUntil: 'domcontentloaded',
        timeout: this.env.CHECK_TIMEOUT_MS,
      });
      return extractProduct(await page.content(), source);
    } finally {
      await browser.close();
    }
  }
}
