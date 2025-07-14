// Value parsing helpers inspired by Tailwind CSS value-parser.ts

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
 */
export function parseNumber(input: string): string | null {
  return /^\d+$/.test(input) ? input : null;
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