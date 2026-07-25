import { describe, expect, it } from 'vitest';
import { detectAvailability } from '../src/shared/utils/availability.js';

describe('detectAvailability', () => {
  it.each([
    'in stock',
    'ADD TO CART',
    'Disponible',
    'Comprar',
    'Añadir al carrito',
    'Agregar al carro',
    'Stock online',
  ])('detects %s', (text) => expect(detectAvailability(text)).toBe(true));
  it.each([
    'out of stock',
    'unavailable',
    'Agotado',
    'sin stock',
    'sin existencias',
    'no disponible',
    'Este producto no está disponible actualmente',
    'Este producto no esta disponible actualmente',
  ])('rejects %s', (text) => expect(detectAvailability(text)).toBe(false));
});
