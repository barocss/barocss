import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * List style utilities for Tailwind CSS v4
 * Handles list-style-type, list-style-position, list-style-image
 */

// list-style-type: list-none, list-disc, list-decimal, list-[upper-roman]
export const listStyleType = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: list-[upper-roman]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { listStyleType: utility.arbitraryValue + importantString };
  }
  
  // Handle common values
  const typeMap: Record<string, string> = {
    'none': 'none',
    'disc': 'disc',
    'circle': 'circle',
    'square': 'square',
    'decimal': 'decimal',
    'decimal-leading-zero': 'decimal-leading-zero',
    'lower-roman': 'lower-roman',
    'upper-roman': 'upper-roman',
    'lower-alpha': 'lower-alpha',
    'upper-alpha': 'upper-alpha',
    'lower-latin': 'lower-latin',
    'upper-latin': 'upper-latin',
    'lower-greek': 'lower-greek'
  };
  
  const type = typeMap[utility.value];
  if (type) {
    return { listStyleType: type + importantString };
  }
  
  // Handle theme values
  const themeType = ctx.theme?.('listStyleType', utility.value);
  if (themeType) return { listStyleType: themeType + importantString };
  
  return {};
};

// list-style-position: list-inside, list-outside
export const listStylePosition = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  const positionMap: Record<string, string> = {
    'inside': 'inside',
    'outside': 'outside'
  };
  
  const position = positionMap[utility.value];
  if (position) {
    return { listStylePosition: position + importantString };
  }
  
  return {};
};

// list-style-image: list-image-none, list-image-[url(...)]
export const listStyleImage = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle list-image-none
  if (utility.value === 'none') {
    return { listStyleImage: 'none' + importantString };
  }
  
  // Handle arbitrary values: list-image-[url(./image.png)]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { listStyleImage: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values
  const image = ctx.theme?.('listStyleImage', utility.value);
  if (image) return { listStyleImage: image + importantString };
  
  return {};
};

// Generic list utility (backward compatibility)
export const list = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  return { listStyle: utility.value + importantString };
}; 