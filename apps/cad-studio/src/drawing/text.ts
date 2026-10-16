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
