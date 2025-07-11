import { isColorValue, ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 accent-color utilities
 * https://tailwindcss.com/docs/accent-color
 *
 * Supported classes:
 * - accent-inherit
 * - accent-current
 * - accent-transparent
 * - accent-black, accent-white, accent-red-500, accent-gray-900, accent-regal-blue, ...
 * - accent-(<custom-property>)
 * - accent-[arbitrary]
 * - !important modifier
 */

const accentMap: Record<string, string> = {
  'inherit': 'inherit',
  'current': 'currentColor',
  'transparent': 'transparent',
};

export function accent(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // accent-(--custom) → accent-color: var(--custom)
  if (utility.customProperty && utility.value) {
    return { accentColor: `var(${utility.value})` + important };
  }

  // accent-[arbitrary] → accent-color: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    // If color value, use as is
    if (isColorValue(utility.arbitraryValue)) {
      return { accentColor: utility.arbitraryValue + important };
    }
    // If var(...) or other, use as is
    return { accentColor: utility.arbitraryValue + important };
  }

  // Standard classes
  if (accentMap[utility.value ?? '']) {
    return { accentColor: accentMap[utility.value ?? ''] + important };
  }

  // Theme color: accent-red-500, accent-gray-900, accent-regal-blue, ...
  if (utility.value) {
    // Try theme color (dot notation)
    const colorPath = utility.value.replace(/-/g, '.');
    const css = ctx.theme(`colors.${colorPath}`);
    if (css !== undefined) {
      return { accentColor: css + important };
    }
  }
  return undefined;
} 