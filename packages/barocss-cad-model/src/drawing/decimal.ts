/** Exact decimal arithmetic for Drawing values. */
export interface DecimalValue { integer: bigint; places: number }

/** Model numbers mean their canonical decimal spelling, before arithmetic. */
export function decimalValue(value: number | string): DecimalValue {
  const [mantissa, power = '0'] = String(value).toLowerCase().split('e'), dot = mantissa.indexOf('.');
  const places = (dot < 0 ? 0 : mantissa.length - dot - 1) - Number(power), integer = BigInt(mantissa.replace('.', ''));
  return places < 0 ? { integer: integer * 10n ** BigInt(-places), places: 0 } : { integer, places };
}

export const decimalAt = (value: DecimalValue, places: number): bigint => value.integer * 10n ** BigInt(places - value.places);

/** Exact unsigned decimal text from integer grid ticks. */
export function tickNumber(value: bigint, digits: number, leadingZero: boolean, trim: boolean): string {
  const raw = (value < 0n ? -value : value).toString().padStart(digits + 1, '0');
  let text = digits ? `${raw.slice(0, -digits)}.${raw.slice(-digits)}` : raw;
  if (trim && text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return leadingZero ? text : text.replace(/^0\./, '.');
}
