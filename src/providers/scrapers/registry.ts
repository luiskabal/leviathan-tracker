import type { ProductSource } from '@prisma/client';
import type { ProductScraper } from './types.js';

export class ScraperRegistry {
  constructor(private readonly scrapers: ProductScraper[]) {}
  for(source: ProductSource): ProductScraper {
    const scraper = this.scrapers.find((candidate) => candidate.canHandle(source));
    if (!scraper) throw new Error(`No scraper supports ${source.scraperType}`);
    return scraper;
  }
}
