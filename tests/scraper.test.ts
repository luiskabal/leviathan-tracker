import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractProduct } from '../src/providers/scrapers/extract.js';

describe('static extraction', () => {
  it('extracts configured fields from local HTML', () => {
    const html = readFileSync(new URL('./fixtures/product.html', import.meta.url), 'utf8');
    const result = extractProduct(html, {
      id: 'source',
      productId: 'product',
      storeName: 'Fixture',
      url: 'https://example.com',
      country: 'US',
      currency: 'USD',
      scraperType: 'STATIC',
      enabled: true,
      selectors: {
        price: '.price',
        availability: '.availability',
        title: '.title',
        seller: '.seller',
      },
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result).toMatchObject({
      title: 'G.Skill Memory',
      available: true,
      price: 499.99,
      currency: 'USD',
      seller: 'Fixture Store',
    });
    expect(result.contentHash).toHaveLength(64);
  });
  it('reports selector drift', () => {
    expect(() =>
      extractProduct('<html></html>', {
        id: 's',
        productId: 'p',
        storeName: 'x',
        url: 'https://example.com',
        country: 'US',
        currency: 'USD',
        scraperType: 'STATIC',
        enabled: true,
        selectors: { price: '.missing' },
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(/selector/i);
  });
});
