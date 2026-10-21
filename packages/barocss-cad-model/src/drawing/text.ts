// Text measured in Helvetica's advance widths, for centring (PDF) and for fitting text into a box.

/** Helvetica advance widths (per 1000 em), close enough to lay text out. */
export function textWidth(s: string, size: number, bold: boolean): number {
  let w = 0;
  for (const ch of s) {
    if (/[0-9]/.test(ch)) w += 556;
    else if (ch === '.' || ch === ',' || ch === ' ' || ch === ':' || ch === '/') w += 278;
    else if (ch === '-' || ch === '(' || ch === ')') w += 333;
    else if (ch === '–' || ch === '…') w += 1000;
    else if (/[iIjl]/.test(ch)) w += 240;
    else if (/[mwMW]/.test(ch)) w += 860;
    else if (/[A-Z]|Ø/.test(ch)) w += bold ? 722 : 690;
    else w += bold ? 611 : 556;
  }
  return w / 1000 * size;
}

/**
 * Text that fits `width` (mm): at `size` if it fits, else shrunk down to `floor`, and at the floor cut
 * with an ellipsis. (5 % spare for fonts a little wider than Helvetica.)
 */
export function fitText(text: string, size: number, bold: boolean, width: number, floor: number): { text: string; size: number } {
  const room = width * 0.95, w = textWidth(text, size, bold);
  if (w <= room) return { text, size };
  const shrunk = size * room / w;
  if (shrunk >= floor) return { text, size: Math.floor(shrunk * 100) / 100 };
  const chars = [...text];
  while (chars.length > 1 && textWidth(chars.join('').trimEnd() + '…', floor, bold) > room) chars.pop();
  return { text: chars.join('').trimEnd() + '…', size: floor };
}

/**
 * A line of text's box on the sheet (y down): its four corners in order, from its baseline point, anchor, size and
 * angle (degrees counter-clockwise as read) — from a little under the baseline to the capital height.
 */
export function textCorners(at: readonly [number, number], text: string, size: number, anchor: 'start' | 'middle' | 'end', angle = 0, bold = false): [[number, number], [number, number], [number, number], [number, number]] {
  const w = textWidth(text, size, bold), x0 = anchor === 'start' ? 0 : anchor === 'middle' ? -w / 2 : -w;
  const top = -0.8 * size, bottom = 0.22 * size, a = -angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const p = (x: number, y: number): [number, number] => [at[0] + c * x - s * y, at[1] + s * x + c * y];
  return [p(x0, top), p(x0 + w, top), p(x0 + w, bottom), p(x0, bottom)];
}
