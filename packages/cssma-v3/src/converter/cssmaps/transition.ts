import { isNumberValue, ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 transition-property utilities
 * https://tailwindcss.com/docs/transition-property
 *
 * Supported classes:
 * - transition (default set)
 * - transition-none
 * - transition-all
 * - transition-colors
 * - transition-opacity
 * - transition-shadow
 * - transition-transform
 * - transition-(--custom)
 * - transition-[arbitrary]
 * - !important modifier
 */

const transitionPropertyMap: Record<string, string> = {
  'none': 'none',
  'all': 'all',
  'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
  'opacity': 'opacity',
  'shadow': 'box-shadow',
  'transform': 'transform',
};

const DEFAULT_TRANSITION = 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter';

export function transition(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // transition-(--custom) → transition-property: var(--custom)
  if (utility.customProperty && utility.value) {
    return { transitionProperty: `var(${utility.value})` + important };
  }

  // transition-[arbitrary] → transition-property: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transitionProperty: utility.arbitraryValue + important };
  }

  // Standard classes
  if (utility.value && transitionPropertyMap[utility.value]) {
    return { transitionProperty: transitionPropertyMap[utility.value] + important };
  }

  // "transition" (no value) → default set
  if (!utility.value) {
    return { transitionProperty: DEFAULT_TRANSITION + important };
  }

  return undefined;
}

/**
 * TailwindCSS v4.1 transition-duration utilities
 * https://tailwindcss.com/docs/transition-duration
 *
 * Supported classes:
 * - duration-75, duration-150, ... (theme lookup)
 * - duration-[arbitrary]
 * - !important
 */
export function duration(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transitionDuration: utility.arbitraryValue + important };
  }
  if (utility.value) {
    const themeVal = ctx.theme?.('transitionDuration', utility.value) ?? ctx.theme?.('duration', utility.value);
    if (themeVal !== undefined) {
      return { transitionDuration: themeVal + important };
    }
    // fallback: use as ms if numeric
    if (isNumberValue(utility.value)) {
      return { transitionDuration: utility.value + 'ms' + important };
    }
    return { transitionDuration: utility.value + important };
  }
  return undefined;
}

/**
 * TailwindCSS v4.1 transition-delay utilities
 * https://tailwindcss.com/docs/transition-delay
 *
 * Supported classes:
 * - delay-75, delay-150, ... (theme lookup)
 * - delay-[arbitrary]
 * - !important
 */
export function delay(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transitionDelay: utility.arbitraryValue + important };
  }
  if (utility.value) {
    const themeVal = ctx.theme?.('transitionDelay', utility.value) ?? ctx.theme?.('delay', utility.value);
    if (themeVal !== undefined) {
      return { transitionDelay: themeVal + important };
    }
    // fallback: use as ms if numeric
    if (isNumberValue(utility.value)) {
      return { transitionDelay: utility.value + 'ms' + important };
    }
    return { transitionDelay: utility.value + important };
  }
  return undefined;
}

/**
 * TailwindCSS v4.1 transition-timing-function utilities
 * https://tailwindcss.com/docs/transition-timing-function
 *
 * Supported classes:
 * - ease-linear, ease-in, ease-out, ease-in-out (theme lookup)
 * - ease-[arbitrary]
 * - !important
 */
export function ease(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transitionTimingFunction: utility.arbitraryValue + important };
  }
  if (utility.value) {
    const themeVal = ctx.theme?.('ease', utility.value);
    if (themeVal !== undefined) {
      return { transitionTimingFunction: themeVal + important };
    }
    return { transitionTimingFunction: utility.value + important };
  }
  return undefined;
} 