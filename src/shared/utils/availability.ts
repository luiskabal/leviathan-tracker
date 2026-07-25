const POSITIVE = [
  'in stock',
  'add to cart',
  'disponible',
  'comprar',
  'añadir al carrito',
  'agregar al carro',
  'stock online',
];
const NEGATIVE = [
  'out of stock',
  'unavailable',
  'agotado',
  'sin stock',
  'sin existencias',
  'no disponible',
  'no está disponible',
  'no esta disponible',
];

export function detectAvailability(text: string): boolean {
  const normalized = text.toLocaleLowerCase();
  if (NEGATIVE.some((word) => normalized.includes(word))) return false;
  return POSITIVE.some((word) => normalized.includes(word));
}
