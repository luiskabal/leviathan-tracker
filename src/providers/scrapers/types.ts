import type { ProductSource } from '@prisma/client';

export type Selectors = {
  price?: string;
  availability?: string;
  title?: string;
  seller?: string;
};

export type ScrapeResult = {
  title?: string;
  available: boolean;
  price?: number;
  currency?: string;
  seller?: string;
  rawAvailability?: string;
  contentHash?: string;
};

export interface ProductScraper {
  canHandle(source: ProductSource): boolean;
  check(source: ProductSource): Promise<ScrapeResult>;
}
