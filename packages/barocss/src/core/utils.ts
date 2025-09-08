// Value parsing helpers inspired by  value-parser.ts

/**
 * Extracts the value from [arbitrary] syntax, or returns null if not arbitrary.
 */
export function parseArbitraryValue(input: string): string | null {
  return input.startsWith('[') && input.endsWith(']') ? input.slice(1, -1) : null;
}

/**
 * Parses a fraction string (e.g., '1/2') and returns a percentage string (e.g., '50%'), or null if not a valid fraction.
 */
export function parseFraction(input: string): string | null {
  if (input.includes('/')) {
    const [num, denom] = input.split('/').map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return `${(num / denom) * 100}%`;
    }
  }
  return null;
}

/**
 * Returns the input if it is a valid non-negative integer string, else null.
 * 
 * @example
 * parseNumber("10") // "10"
 * parseNumber("-10") // "-10"
 * parseNumber("10.5") // "10.5"
 */
export function parseNumber(input: string): string | null {
  // Accept integers and decimals (e.g., 1, -2, 1.5, -0.25)
  return /^-?\d+(?:\.\d+)?$/.test(input) ? input : null;
}

/**
 * Returns the input if it is a valid length string, else null.
 */
export function parseLength(input: string): string | null {
  return /^\d+(px|em|rem|vh|vw|vmin|vmax|%|in|cm|mm|pt|pc|ex|ch|fr)$/.test(input) ? input : null;
}

/**
 * Returns the input without a leading '-' if negative, else null.
 */
export function parseNegative(input: string): string | null {
  return input.startsWith('-') ? input.slice(1) : null;
}

/**
 * Returns the input if it is a valid CSS var() expression, else null.
 */
export function parseVar(input: string): string | null {
  return input.startsWith('var(') && input.endsWith(')') ? input : null;
}

/**
 * Unified parser for fraction or number, with options for percent or repeat syntax.
 * - percent: if true, returns percentage for fraction (e.g., '1/2' -> '50%')
 * - repeat: if true, returns repeat() for number (e.g., '3' -> 'repeat(3, minmax(0, 1fr))')
 */
export function parseFractionOrNumber(value: string, opts: { percent?: boolean; repeat?: boolean } = {}): string | null {
  if (/^\d+$/.test(value)) {
    if (opts.repeat) return `repeat(${value}, minmax(0, 1fr))`;
    return value;
  }
  if (value.includes('/')) {
    const [numerator, denominator] = value.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      const result = numerator / denominator;
      if (opts.percent) return `${result * 100}%`;
      return result.toString();
    }
  }
  return null;
} 

/**
 * Returns the input if it is a valid color string, else null.
 *
 * #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(r, g, b), rgb(r, g, b, a), hsl(h, s, l), hsl(h, s, l, a), hwb(h, w, b), hwb(h, w, b, a), lab(l, a, b), lab(l, a, b, a), lch(l, c, h), lch(l, c, h, a), oklab(l, a, b), oklab(l, a, b, a), oklch(l, c, h), oklch(l, c, h, a), color-mix(in oklab, var(--color-blue-500) 60%, transparent)
 */
export function parseColor(input: string): string | null {
  if (input.startsWith('color:')) {
    return input.slice(6);
  }

  // hex
  if (input.startsWith('#') && input.length === 4) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 5) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 7) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 9) {
    return `#${input.slice(1)}`;
  }


  // rgb
  if (input.startsWith('rgb(')) {
    return input.slice(4, -1);
  }

  // rgba
  if (input.startsWith('rgba(')) {
    return input.slice(5, -1);
  }

  // hsl
  if (input.startsWith('hsl(')) {
    return input.slice(4, -1);
  }

  // hsla
  if (input.startsWith('hsla(')) {
    return input.slice(5, -1);
  }

  // hwb
  if (input.startsWith('hwb(')) {
    return input.slice(4, -1);
  }

  // lab
  if (input.startsWith('lab(')) {
    return input.slice(4, -1);
  }

  // lch
  if (input.startsWith('lch(')) {
    return input.slice(4, -1);
  }

  // oklab
  if (input.startsWith('oklab(')) {
    return input.slice(5, -1);
  }

  // oklch
  if (input.startsWith('oklch(')) {
    return input.slice(6, -1);
  }

  // color-mix
  if (input.startsWith('color-mix(')) {
    return input.slice(9, -1);
  }

  return null;
}