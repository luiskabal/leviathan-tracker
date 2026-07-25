import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { ProductSource } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { detectAvailability } from '../../shared/utils/availability.js';
import { parsePrice } from '../../shared/utils/price.js';
import type { ScrapeResult, Selectors } from './types.js';

export function extractProduct(html: string, source: ProductSource): ScrapeResult {
  const $ = cheerio.load(html);
  const selectors = source.selectors as Selectors;
  if (!selectors.price && !selectors.availability) {
    throw new AppError('Source requires at least a price or availability selector', 422, 'SELECTORS');
  }
  const text = (selector?: string) => (selector ? $(selector).first().text().trim() : undefined);
  const rawAvailability = text(selectors.availability);
  const priceText = text(selectors.price);
  if (selectors.price && !priceText) throw new AppError('Price selector did not match', 422, 'STRUCTURE_CHANGED');
  if (selectors.availability && !rawAvailability) {
    throw new AppError('Availability selector did not match', 422, 'STRUCTURE_CHANGED');
  }
  const parsed = priceText ? parsePrice(priceText, source.currency) : undefined;
  return {
    title: text(selectors.title),
    available: detectAvailability(rawAvailability ?? $('body').text()),
    price: parsed?.amount,
    currency: parsed?.currency ?? source.currency,
    seller: text(selectors.seller),
    rawAvailability,
    contentHash: createHash('sha256').update(html).digest('hex'),
  };
}
