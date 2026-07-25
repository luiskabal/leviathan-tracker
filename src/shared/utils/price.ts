export type ParsedPrice = { amount: number; currency: string };

const CURRENCIES: Array<[RegExp, string]> = [
  [/\b(?:US\$|USD)\b/i, 'USD'],
  [/\b(?:CLP)\b/i, 'CLP'],
  [/\bEUR\b|€/i, 'EUR'],
  [/\bGBP\b|£/i, 'GBP'],
  [/\bCAD\b|C\$/i, 'CAD'],
];

export function parsePrice(text: string, fallbackCurrency = 'USD'): ParsedPrice | undefined {
  const currency =
    CURRENCIES.find(([pattern]) => pattern.test(text))?.[1] ??
    (text.includes('$') ? fallbackCurrency : fallbackCurrency);
  const match = text.replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!match) return undefined;

  let value = match[0];
  const dots = [...value.matchAll(/\./g)].map((item) => item.index!);
  const commas = [...value.matchAll(/,/g)].map((item) => item.index!);
  const lastDot = dots.at(-1) ?? -1;
  const lastComma = commas.at(-1) ?? -1;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    value = value
      .replace(decimal === '.' ? /,/g : /\./g, '')
      .replace(decimal === ',' ? ',' : '.', '.');
  } else {
    const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : undefined;
    if (separator) {
      const pieces = value.split(separator);
      const finalLength = pieces.at(-1)?.length ?? 0;
      const isThousands =
        finalLength === 3 &&
        (pieces.length > 2 || currency === 'CLP' || (pieces[0]?.length ?? 0) <= 3);
      value = isThousands ? pieces.join('') : `${pieces.slice(0, -1).join('')}.${pieces.at(-1)}`;
    }
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? { amount, currency } : undefined;
}
