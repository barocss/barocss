import { isColorValue, ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 caret-color utilities
 * https://tailwindcss.com/docs/caret-color
 *
 * Supported classes:
 * - caret-inherit
 * - caret-current
 * - caret-transparent
 * - caret-black, caret-white, caret-red-500, caret-gray-900, caret-regal-blue, ...
 * - caret-(<custom-property>)
 * - caret-[arbitrary]
 * - !important modifier
 */

const caretMap: Record<string, string> = {
  'inherit': 'inherit',
  'current': 'currentColor',
  'transparent': 'transparent',
};

export function caret(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';

  // caret-(--custom) → caret-color: var(--custom)
  if (utility.customProperty && utility.value) {
    return { caretColor: `var(${utility.value})` + important };
  }

  // caret-[arbitrary] → caret-color: <arbitrary>
  if (utility.arbitrary && utility.arbitraryValue) {
    // If color value, use as is
    if (isColorValue(utility.arbitraryValue)) {
      return { caretColor: utility.arbitraryValue + important };
    }
    // If var(...) or other, use as is
    return { caretColor: utility.arbitraryValue + important };
  }

  // Standard classes
  if (caretMap[utility.value ?? '']) {
    return { caretColor: caretMap[utility.value ?? ''] + important };
  }

  // Theme color: caret-red-500, caret-gray-900, caret-regal-blue, ...
  if (utility.value) {
    const colorPath = utility.value.replace(/-/g, '.');
    const css = ctx.theme(`colors.${colorPath}`);
    if (css !== undefined) {
      return { caretColor: css + important };
    }
  }
  return undefined;
} 