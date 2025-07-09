import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * Text layout utilities for Tailwind CSS v4
 * Handles text-wrap, text-overflow, text-indent, white-space, word-break, overflow-wrap, hyphens, line-height, letter-spacing
 */

// text-overflow: text-ellipsis, text-clip, truncate
export const textOverflow = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  const overflowMap: Record<string, string> = {
    'text-ellipsis': 'ellipsis',
    'text-clip': 'clip',
    'truncate': 'ellipsis'
  };
  
  // Handle keyword-only syntax: text-ellipsis, text-clip, truncate
  if (utility.prefix && !utility.value && overflowMap[utility.prefix]) {
    const result: Record<string, string> = {
      textOverflow: overflowMap[utility.prefix] + importantString
    };
    
    // For truncate, also add required properties
    if (utility.prefix === 'truncate') {
      result.overflow = 'hidden' + importantString;
      result.whiteSpace = 'nowrap' + importantString;
    }
    
    return result;
  }
  
  return {};
};

// text-indent utilities for Tailwind CSS v4.1
// indent-<number>, -indent-<number>, indent-px, -indent-px, indent-[<value>], indent-(<custom-property>)
export const textIndent = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle negative values: -indent-<number>, -indent-px
  if (utility.negative && utility.value) {
    // Handle px keyword for negative
    if (utility.value === 'px') {
      return { textIndent: '-1px' + importantString };
    }
    
    // Check if it's a numeric value for negative
    const numericValue = parseFloat(utility.value);
    if (!isNaN(numericValue)) {
      // Use spacing theme for negative values
      const spacingValue = ctx.theme?.('spacing', utility.value);
      if (spacingValue) {
        return { textIndent: `calc(${spacingValue} * -1)` + importantString };
      }
      // Fallback to direct calculation
      return { textIndent: `calc(${numericValue * 0.25}rem * -1)` + importantString };
    }
    
    // Handle theme values for negative
    const themeValue = ctx.theme?.('textIndent', utility.value);
    if (themeValue) {
      return { textIndent: `calc(${themeValue} * -1)` + importantString };
    }
  }
  
  // Handle px keyword: indent-px
  if (utility.value === 'px') {
    return { textIndent: '1px' + importantString };
  }
  
  // Handle arbitrary values: indent-[32px], indent-[2rem]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { textIndent: utility.arbitraryValue + importantString };
  }
  
  // Handle custom properties: indent-(--my-indent)
  if (utility.customProperty && utility.value) {
    return { textIndent: `var(${utility.value})` + importantString };
  }
  
  // Handle numeric values: indent-0, indent-1, indent-2, indent-4, etc.
  if (utility.value) {
    const numericValue = parseFloat(utility.value);
    if (!isNaN(numericValue)) {
      // Use spacing theme for standard values
      const spacingValue = ctx.theme?.('spacing', utility.value);
      if (spacingValue) {
        return { textIndent: spacingValue + importantString };
      }
      // Fallback calculation (Tailwind default: 0.25rem per unit)
      return { textIndent: `${numericValue * 0.25}rem` + importantString };
    }
    
    // Try theme values for non-numeric
    const themeValue = ctx.theme?.('textIndent', utility.value);
    if (themeValue) {
      return { textIndent: themeValue + importantString };
    }
  }
  
  return {};
};


const spaceMap: Record<string, string> = {
  'normal': 'normal',
  'nowrap': 'nowrap',
  'pre': 'pre',
  'pre-line': 'pre-line',
  'pre-wrap': 'pre-wrap',
  'break-spaces': 'break-spaces'
};

// white-space: whitespace-normal, whitespace-nowrap, whitespace-pre, whitespace-pre-line, whitespace-pre-wrap, whitespace-break-spaces
export const whiteSpace = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  
  // Handle keyword-only syntax
  if (utility.prefix && utility.value && spaceMap[utility.value]) {
    return { whiteSpace: spaceMap[utility.value] + importantString };
  }
  
  return {};
};

const breakMap: Record<string, string> = {
  'normal': 'normal',
  'all': 'break-all',
  'keep': 'keep-all'
};

// word-break: break-normal, break-words, break-all, break-keep
export const wordBreak = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax
  if (utility.prefix && utility.value && breakMap[utility.value]) {
    return { wordBreak: breakMap[utility.value] + importantString };
  }
  
  return {};
};


const wrapMap: Record<string, string> = {
  'normal': 'normal',
  'break-word': 'break-word',
  'anywhere': 'anywhere'
};

// overflow-wrap: wrap-normal, wrap-break-word, wrap-anywhere
export const overflowWrap = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  if (utility.prefix && utility.value && wrapMap[utility.value]) {
    return { overflowWrap: wrapMap[utility.value] + importantString };
  }
  
  return {};
};

  
const hyphenMap: Record<string, string> = {
  'none': 'none',
  'manual': 'manual',
  'auto': 'auto'
};

// hyphens: hyphens-none, hyphens-manual, hyphens-auto
export const hyphens = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax
  if (utility.prefix && utility.value && hyphenMap[utility.value]) {
    return { hyphens: hyphenMap[utility.value] + importantString };
  }
  
  return {};
};

// line-height: leading-3, leading-4, leading-none, leading-tight, leading-[1.25]
export const lineHeight = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: leading-[1.25]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { lineHeight: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values: leading-3, leading-4, leading-none, etc.
  const height = ctx.theme?.('lineHeight', utility.value);
  if (height) return { lineHeight: height + importantString };
  
  return {};
};

// letter-spacing: tracking-tighter, tracking-tight, tracking-normal, tracking-wide, tracking-[0.25em]
export const letterSpacing = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: tracking-[0.25em]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { letterSpacing: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values: tracking-tighter, tracking-tight, etc.
  const spacing = ctx.theme?.('letterSpacing', utility.value);
  if (spacing) return { letterSpacing: spacing + importantString };
  
  return {};
};

// line-clamp: line-clamp-1, line-clamp-2, line-clamp-none, line-clamp-[10]
export const lineClamp = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle line-clamp-none
  if (utility.value === 'none') {
    return {
      overflow: 'visible' + importantString,
      display: '-webkit-box' + importantString,
      '-webkit-box-orient': 'vertical' + importantString,
      '-webkit-line-clamp': 'none' + importantString
    };
  }
  
  // Handle arbitrary values: line-clamp-[10]
  if (utility.arbitrary && utility.arbitraryValue) {
    return {
      overflow: 'hidden' + importantString,
      display: '-webkit-box' + importantString,
      '-webkit-box-orient': 'vertical' + importantString,
      '-webkit-line-clamp': utility.arbitraryValue + importantString
    };
  }
  
  // Handle theme values: line-clamp-1, line-clamp-2, etc.
  const clamp = ctx.theme?.('lineClamp', utility.value);
  if (clamp) {
    return {
      overflow: 'hidden' + importantString,
      display: '-webkit-box' + importantString,
      '-webkit-box-orient': 'vertical' + importantString,
      '-webkit-line-clamp': clamp + importantString
    };
  }
  
  return {};
};