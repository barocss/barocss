import { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 will-change utilities
 * https://tailwindcss.com/docs/will-change
 *
 * Supported classes:
 * - will-change-auto
 * - will-change-scroll
 * - will-change-contents
 * - will-change-transform
 * - will-change-(--value)
 * - will-change-[arbitrary]
 * - !important modifier
 */

const willChangeMap: Record<string, string> = {
  'auto': 'auto',
  'scroll': 'scroll',
  'contents': 'contents',
  'transform': 'transform',
};

export function willChange(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';

  // will-change-(--value)
  if (utility.customProperty && utility.value) {
    return { willChange: `var(${utility.value})` + important };
  }

  // Arbitrary value: will-change-[value]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { willChange: utility.arbitraryValue + important };
  }

  // Standard classes
  const value = willChangeMap[utility.value];
  if (value) {
    return { willChange: value + important };
  }
  return undefined;
} 