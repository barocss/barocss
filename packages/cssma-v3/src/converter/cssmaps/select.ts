import { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 user-select utilities
 * https://tailwindcss.com/docs/user-select
 *
 * Supported classes:
 * - select-auto
 * - select-text
 * - select-all
 * - select-none
 * - !important modifier
 */

const userSelectMap: Record<string, string> = {
  'auto': 'auto',
  'text': 'text',
  'all': 'all',
  'none': 'none',
};

export function select(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';

  // Standard classes
  const value = userSelectMap[utility.value];
  if (value) {
    return { userSelect: value + important };
  }
  return undefined;
} 