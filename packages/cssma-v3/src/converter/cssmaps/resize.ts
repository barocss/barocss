import { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 resize utilities
 * https://tailwindcss.com/docs/resize
 *
 * Supported classes:
 * - resize-none
 * - resize-y
 * - resize-x
 * - resize
 * - !important modifier
 */

const resizeMap: Record<string, string> = {
  'none': 'none',
  'y': 'vertical',
  'x': 'horizontal',
  '': 'both', // 'resize' with no suffix
};

export function resize(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';

  // Standard classes
  const value = resizeMap[utility.value ?? ''];
  if (value) {
    return { resize: value + important };
  }
  return undefined;
} 