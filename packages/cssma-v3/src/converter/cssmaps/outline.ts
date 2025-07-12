import { isColorValue, isLengthValue, isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * Outline styles supported by Tailwind CSS v4
 */
const OUTLINE_STYLES = [
  'solid', 'dashed', 'dotted', 'double', 'none', 'hidden'
] as const;

/**
 * CSS color keywords that should be treated as colors
 */
const CSS_COLOR_KEYWORDS = [
  'transparent', 'currentColor', 'inherit', 'initial', 'unset', 'revert',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime', 'indigo',
  'violet', 'turquoise', 'gold', 'silver', 'navy', 'teal', 'olive',
  'maroon', 'aqua', 'fuchsia'
] as const;

/**
 * Check if a value is a CSS color (including keywords)
 */
function isCssColor(value: string): boolean {
  return isColorValue(value) || CSS_COLOR_KEYWORDS.includes(value as any);
}

/**
 * Utility functions for value type detection
 */
function isOutlineStyleValue(value: string): boolean {
  return OUTLINE_STYLES.includes(value as any);
}

/**
 * outline utilities - handles width, color, style, and offset
 * outline → outline-width: 1px;
 * outline-2 → outline-width: 2px;
 * outline-blue-500 → outline-color: var(--color-blue-500);
 * outline-solid → outline-style: solid;
 * outline-[3px] → outline-width: 3px;
 * outline-[#ff0000] → outline-color: #ff0000;
 * outline-[dashed] → outline-style: dashed;
 */
export const outline = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (outline) - default to 1px width
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { outlineWidth: '1px' + importantString };
  }

  // Handle arbitrary values: outline-[3px], outline-[#ff0000], outline-[solid]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    // Skip empty arbitrary values
    if (!value) {
      return {};
    }
    
    if (isLengthValue(value) || isNumberValue(value)) {
      const width = isNumberValue(value) ? `${value}px` : value;
      return { outlineWidth: width + importantString };
    }
    if (isCssColor(value)) {
      return { outlineColor: value + importantString };
    }
    if (isOutlineStyleValue(value)) {
      return { outlineStyle: value + importantString };
    }
    // Fallback for other arbitrary values
    return { outlineWidth: value + importantString };
  }

  // Handle custom properties: outline-(length:--my-width), outline-(color:--my-color)
  if (utility.customProperty && utility.value) {
    const cleanValue = utility.value.replace(/^(length|color|style):/, '');
    
    // Determine property based on type prefix or value analysis
    if (utility.value.startsWith('length:')) {
      return { outlineWidth: `var(${cleanValue})` + importantString };
    }
    if (utility.value.startsWith('color:')) {
      return { outlineColor: `var(${cleanValue})` + importantString };
    }
    if (utility.value.startsWith('style:')) {
      return { outlineStyle: `var(${cleanValue})` + importantString };
    }
    
    // Default to width for unspecified custom properties
    return { outlineWidth: `var(${cleanValue})` + importantString };
  }

  // Handle numeric values: outline-2, outline-4
  if (utility.numeric && utility.value) {
    const width = `${utility.value}px`;
    return { outlineWidth: width + importantString };
  }

  // Handle theme colors: outline-red-500, outline-blue-100 (CHECK BEFORE CSS KEYWORDS AND STYLES)
  if (utility.value) {
    // red-500 → red.500으로 변환
    const colorPath = utility.value.replace(/-(\d+)$/, '.$1');
    let css = ctx.theme(`colors.${colorPath}`);
    if (css) {
      return { outlineColor: css + importantString };
    }
  }

  // Handle CSS color keywords and hex values BEFORE outline styles
  if (utility.value && isCssColor(utility.value)) {
    return { outlineColor: utility.value + importantString };
  }

  // Handle outline styles: outline-solid, outline-dashed, outline-dotted, etc.
  if (utility.value && isOutlineStyleValue(utility.value)) {
    if (utility.value === 'hidden') {
      // outline-hidden special case (like border-hidden in Tailwind v4)
      return { 
        outline: '2px solid transparent' + importantString,
        outlineOffset: '2px' + importantString
      };
    }
    return { outlineStyle: utility.value + importantString };
  }

  // Fallback: treat as width
  if (utility.value) {
    const width = isNumberValue(utility.value) ? `${utility.value}px` : utility.value;
    return { outlineWidth: width + importantString };
  }

  return {};
};

/**
 * outline-offset utilities
 * outline-offset-0 → outline-offset: 0px;
 * outline-offset-2 → outline-offset: 2px;
 * outline-offset-4 → outline-offset: 4px;
 * -outline-offset-2 → outline-offset: -2px;
 * outline-offset-[3px] → outline-offset: 3px;
 * outline-offset-(--my-offset) → outline-offset: var(--my-offset);
 */
export const outlineOffset = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (outline-offset) - default to 2px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { outlineOffset: '2px' + importantString };
  }

  // Handle arbitrary values: outline-offset-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { outlineOffset: utility.arbitraryValue + importantString };
  }

  // Handle custom properties: outline-offset-(--my-offset)
  if (utility.customProperty && utility.value) {
    const cleanValue = utility.value.replace(/^length:/, '');
    return { outlineOffset: `var(${cleanValue})` + importantString };
  }

  // Handle numeric values: outline-offset-2, outline-offset-4
  if (utility.numeric && utility.value) {
    const offset = `${utility.value}px`;
    return { outlineOffset: offset + importantString };
  }

  // Handle negative values: -outline-offset-2
  if (utility.value && utility.value.startsWith('-')) {
    const numericValue = utility.value.substring(1);
    if (isNumberValue(numericValue)) {
      const offset = `calc(${numericValue}px * -1)`;
      return { outlineOffset: offset + importantString };
    }
  }

  // Handle regular values
  if (utility.value) {
    const offset = isNumberValue(utility.value) ? `${utility.value}px` : utility.value;
    return { outlineOffset: offset + importantString };
  }

  return {};
}; 