import { describe, expect, it } from 'vitest';
import { parsePrice } from '../src/shared/utils/price.js';

describe('parsePrice', () => {
  it.each([
    ['US$499.99', 'USD', 499.99],
    ['$499.990', 'CLP', 499990],
    ['CLP 499.990', 'CLP', 499990],
    ['USD 499,99', 'USD', 499.99],
    ['499,99 €', 'EUR', 499.99],
    ['USD 1,299.95', 'USD', 1299.95],
    ['EUR 1.299,95', 'EUR', 1299.95],
  ])('%s', (text, currency, amount) => {
    expect(parsePrice(text, currency)).toEqual({ amount, currency });
  });
  it('returns undefined without digits', () => expect(parsePrice('ask for price')).toBeUndefined());
});
