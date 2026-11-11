import { fmt } from '@barocss/cad-model/engine/doc';

/** Keep the existing display text, except when it hides a finite nonzero quantity. */
export function quantityText(value: number, text = fmt(value)): string {
  if (value === 0) return '0';
  return Number.isFinite(value) && value !== 0 && Number(text.replace(/,/g, '')) === 0
    ? value.toExponential(2) : text;
}

export function measureQuantityText(value: number, digits: 2 | 3): string {
  const factor = 10 ** digits;
  return quantityText(value, fmt(Math.round(value * factor) / factor));
}
