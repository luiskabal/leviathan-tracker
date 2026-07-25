const POSITIVE = ['in stock', 'add to cart', 'disponible', 'comprar'];
const NEGATIVE = ['out of stock', 'unavailable', 'agotado', 'sin stock', 'no disponible'];

export function detectAvailability(text: string): boolean {
  const normalized = text.toLocaleLowerCase();
  if (NEGATIVE.some((word) => normalized.includes(word))) return false;
  return POSITIVE.some((word) => normalized.includes(word));
}
