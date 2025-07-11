import { ParsedClassToken } from "../../parser/utils";

/**
 * TailwindCSS v4.1 color-scheme utilities
 * https://tailwindcss.com/docs/color-scheme
 *
 * Supported classes:
 * - scheme-normal
 * - scheme-light
 * - scheme-dark
 * - scheme-light-dark
 * - scheme-only-light
 * - scheme-only-dark
 * - !important modifier
 */

const colorSchemeMap: Record<string, string> = {
  'normal': 'normal',
  'light': 'light',
  'dark': 'dark',
  'light-dark': 'light dark',   
  'only-light': 'only light',
  'only-dark': 'only dark',
};

export function colorScheme(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';

  // Standard classes
  const value = colorSchemeMap[utility.value ?? ''];
  if (value) {
    return { colorScheme: value + important };
  }
  return undefined;
}

const forcedColorAdjustMap: Record<string, string> = {
  'auto': 'auto',
  'none': 'none',
};

export function forcedColorAdjust(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';
  const value = forcedColorAdjustMap[utility.value ?? ''];
  if (value) {
    return { forcedColorAdjust: value + important };
  }
  return undefined;
}