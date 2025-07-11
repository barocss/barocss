import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 animation utilities
 * https://tailwindcss.com/docs/animation
 *
 * Supported classes:
 * - animate-none
 * - animate-spin, animate-ping, animate-pulse, animate-bounce, ...
 * - animate-(--custom)
 * - animate-[arbitrary]
 * - !important modifier
 */

const animationMap: Record<string, string> = {
  'none': 'none',
};

export function animate(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // animate-(--custom) → animation: var(--custom)
  if (utility.customProperty && utility.value) {
    return { animation: `var(${utility.value})` + important };
  }

  // animate-[arbitrary] → animation: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    return { animation: utility.arbitraryValue + important };
  }

  // Standard classes
  if (utility.value && animationMap[utility.value]) {
    return { animation: animationMap[utility.value] + important };
  }

  // Theme lookup (spin, ping, pulse, bounce, custom)
  if (utility.value) {
    const themeVal = ctx.theme?.('animation', utility.value);
    if (themeVal !== undefined) {
      return { animation: themeVal + important };
    }
    // fallback: use as raw value
    return { animation: utility.value + important };
  }

  return undefined;
} 