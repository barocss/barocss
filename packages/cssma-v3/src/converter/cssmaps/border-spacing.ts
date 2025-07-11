import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 border-spacing utilities
 * https://tailwindcss.com/docs/border-spacing
 *
 * [참고]
 * - https://tailwindcss.com/docs/border-spacing
 */

/**
 * border-spacing-<number>, border-spacing-(--custom), border-spacing-[arbitrary]
 *
 * Examples:
 * - border-spacing-2 → border-spacing: calc(var(--spacing) * 2);
 * - border-spacing-(--foo) → border-spacing: var(--foo);
 * - border-spacing-[7px] → border-spacing: 7px;
 */
export function borderSpacing(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { borderSpacing: `var(${value})` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { borderSpacing: arbitraryValue + important };
  }
  if (value && isNumberValue(value)) {
    return { borderSpacing: `calc(var(--spacing) * ${value})` + important };
  }
  return undefined;
}

/**
 * border-spacing-x-<number>, border-spacing-x-(--custom), border-spacing-x-[arbitrary]
 *
 * Examples:
 * - border-spacing-x-4 → border-spacing: calc(var(--spacing) * 4) var(--tw-border-spacing-y);
 * - border-spacing-x-(--foo) → border-spacing: var(--foo) var(--tw-border-spacing-y);
 * - border-spacing-x-[10px] → border-spacing: 10px var(--tw-border-spacing-y);
 */
export function borderSpacingX(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { borderSpacing: `var(${value}) var(--tw-border-spacing-y)` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { borderSpacing: arbitraryValue + ' var(--tw-border-spacing-y)' + important };
  }
  if (value && isNumberValue(value)) {
    return { borderSpacing: `calc(var(--spacing) * ${value}) var(--tw-border-spacing-y)` + important };
  }
  return undefined;
}

/**
 * border-spacing-y-<number>, border-spacing-y-(--custom), border-spacing-y-[arbitrary]
 *
 * Examples:
 * - border-spacing-y-1 → border-spacing: var(--tw-border-spacing-x) calc(var(--spacing) * 1);
 * - border-spacing-y-(--foo) → border-spacing: var(--tw-border-spacing-x) var(--foo);
 * - border-spacing-y-[5em] → border-spacing: var(--tw-border-spacing-x) 5em;
 */
export function borderSpacingY(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, customProperty, arbitrary, arbitraryValue } = utility;
  if (customProperty && value) {
    return { borderSpacing: `var(--tw-border-spacing-x) var(${value})` + important };
  }
  if (arbitrary && arbitraryValue) {
    return { borderSpacing: `var(--tw-border-spacing-x) ${arbitraryValue}` + important };
  }
  if (value && isNumberValue(value)) {
    return { borderSpacing: `var(--tw-border-spacing-x) calc(var(--spacing) * ${value})` + important };
  }
  return undefined;
} 