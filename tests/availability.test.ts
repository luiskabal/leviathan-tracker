import { describe, expect, it } from 'vitest';
import { detectAvailability } from '../src/shared/utils/availability.js';

describe('detectAvailability', () => {
  it.each(['in stock', 'ADD TO CART', 'Disponible', 'Comprar'])('detects %s', (text) =>
    expect(detectAvailability(text)).toBe(true),
  );
  it.each(['out of stock', 'unavailable', 'Agotado', 'sin stock', 'no disponible'])(
    'rejects %s',
    (text) => expect(detectAvailability(text)).toBe(false),
  );
});
