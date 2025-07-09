import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * Text effects utilities for Tailwind CSS v4
 * Handles text-transform and text-shadow properties
 */

// text-transform: uppercase, lowercase, capitalize, normal-case
export const textTransform = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  const transformMap: Record<string, string> = {
    'uppercase': 'uppercase',
    'lowercase': 'lowercase', 
    'capitalize': 'capitalize',
    'normal-case': 'none'
  };
  
  // Handle keyword-only syntax: uppercase, lowercase, capitalize, normal-case
  // These are prefix-only utilities without values
  if (utility.prefix && !utility.value && transformMap[utility.prefix]) {
    return { textTransform: transformMap[utility.prefix] + importantString };
  }
  
  // Handle text-transform with values (for future extensibility)
  if (utility.prefix === 'text-transform' && utility.value) {
    const transform = transformMap[utility.value];
    if (transform) {
      return { textTransform: transform + importantString };
    }
  }
  
  return {};
};

// text-shadow: text-shadow-sm, text-shadow, text-shadow-md, text-shadow-lg, text-shadow-xl, text-shadow-2xl, text-shadow-none, text-shadow-[2px_2px_4px_#000]
export const textShadow = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle text-shadow-none
  if (utility.value === 'none') {
    return { textShadow: 'none' + importantString };
  }
  
  // Handle arbitrary values: text-shadow-[2px_2px_4px_#000]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { textShadow: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values: text-shadow-sm, text-shadow-md, etc.
  const shadow = ctx.theme?.('textShadow', utility.value);
  if (shadow) return { textShadow: shadow + importantString };
  
  return {};
};