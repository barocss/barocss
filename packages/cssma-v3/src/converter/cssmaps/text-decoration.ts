import { isColorValue, isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * Text decoration utilities for Tailwind CSS v4
 * Handles text-decoration-line, text-decoration-color, text-decoration-style, text-decoration-thickness, text-underline-offset
 */

// Unified decoration function for all decoration- prefix utilities
export const textDecoration = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle decoration style keywords: decoration-solid, decoration-double, decoration-dotted, decoration-dashed, decoration-wavy
  const styleMap: Record<string, string> = {
    'solid': 'solid',
    'double': 'double', 
    'dotted': 'dotted',
    'dashed': 'dashed',
    'wavy': 'wavy'
  };
  
  if (styleMap[utility.value]) {
    return { textDecorationStyle: styleMap[utility.value] + importantString };
  }
  
  // Handle decoration thickness keywords: decoration-auto, decoration-from-font
  if (utility.value === 'auto') {
    return { textDecorationThickness: 'auto' + importantString };
  }
  if (utility.value === 'from-font') {
    return { textDecorationThickness: 'from-font' + importantString };
  }
  
  // Handle decoration thickness numbers: decoration-0, decoration-1, decoration-2, etc.
  const thickness = ctx.theme?.('textDecorationThickness', utility.value);
  if (thickness) {
    return { textDecorationThickness: thickness + importantString };
  }
  
  // Handle decoration color keywords: decoration-inherit, decoration-current, decoration-transparent
  const colorKeywords: Record<string, string> = {
    'inherit': 'inherit',
    'current': 'currentColor',
    'transparent': 'transparent'
  };
  
  if (colorKeywords[utility.value]) {
    return { textDecorationColor: colorKeywords[utility.value] + importantString };
  }
  
  // Handle arbitrary values: decoration-[#ff0000], decoration-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    // Check if it looks like a color
    if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.includes('var(')) {
      return { textDecorationColor: value + importantString };
    }
    // Check if it looks like a thickness value
    if (value.match(/^\d+(\.\d+)?(px|em|rem|%|pt|pc|in|cm|mm|ex|ch)$/)) {
      return { textDecorationThickness: value + importantString };
    }
    // Default to color for other arbitrary values
    return { textDecorationColor: value + importantString };
  }
  
  // Handle custom properties: decoration-(--my-color)
  if (utility.customProperty && utility.value) {
    return { textDecorationColor: `var(${utility.value})` + importantString };
  }
  
  // Handle decoration colors: decoration-red-500, decoration-blue-300, etc. (similar to bg.ts)
  if (utility.value) {
    // Check if it's a color value
    if (isColorValue(utility.value)) {
      // Handle color path like red-500 -> red.500
      const colorPath = utility.value.replace(/-/g, '.');
      const color = ctx.config?.(`theme.colors.${colorPath}`);
      if (color) {
        return { textDecorationColor: color + importantString };
      }
    }
    
    // Handle direct color values like white, black
    const directColor = ctx.config?.(`theme.colors.${utility.value}`);
    if (directColor) {
      return { textDecorationColor: directColor + importantString };
    }
    
    // Try theme function for colors
    const themeColor = ctx.theme?.('colors', utility.value);
    if (themeColor) {
      return { textDecorationColor: themeColor + importantString };
    }
  }
  
  return {};
};

// text-decoration-line: underline, overline, line-through, no-underline
export const textDecorationLine = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax: underline, overline, line-through, no-underline
  const decorationMap: Record<string, string> = {
    'underline': 'underline',
    'overline': 'overline',
    'line-through': 'line-through',
    'no-underline': 'none'
  };
  
  // Handle prefix-only keywords
  if (utility.prefix && !utility.value && decorationMap[utility.prefix]) {
    return { textDecoration: decorationMap[utility.prefix] + importantString };
  }
  
  // Handle text-decoration-line with values
  if (utility.prefix === 'text-decoration-line' && utility.value) {
    const decoration = decorationMap[utility.value];
    if (decoration) {
      return { textDecoration: decoration + importantString };
    }
  }
  
  return {};
};

// text-decoration-color: text-decoration-red-500, text-decoration-[#ff0000]
export const textDecorationColor = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: text-decoration-[#ff0000]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { textDecorationColor: utility.arbitraryValue + importantString };
  }
  
  // Handle custom properties: text-decoration-(color:--my-color)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("color:", "");
    return { textDecorationColor: `var(${value})` + importantString };
  }
  
  // Handle theme colors: text-decoration-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) return { textDecorationColor: color + importantString };
  
  return {};
};

// text-decoration-style: text-decoration-solid, text-decoration-double, text-decoration-dotted, text-decoration-dashed, text-decoration-wavy
export const textDecorationStyle = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  const styleMap: Record<string, string> = {
    'solid': 'solid',
    'double': 'double',
    'dotted': 'dotted',
    'dashed': 'dashed',
    'wavy': 'wavy'
  };
  
  const style = styleMap[utility.value];
  if (style) {
    return { textDecorationStyle: style + importantString };
  }
  
  return {};
};

// text-decoration-thickness: text-decoration-auto, text-decoration-from-font, text-decoration-0, text-decoration-1, text-decoration-[3px]
export const textDecorationThickness = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle specific keywords
  if (utility.value === 'auto') {
    return { textDecorationThickness: 'auto' + importantString };
  }
  if (utility.value === 'from-font') {
    return { textDecorationThickness: 'from-font' + importantString };
  }
  
  // Handle arbitrary values: text-decoration-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { textDecorationThickness: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values: text-decoration-0, text-decoration-1, etc.
  const thickness = ctx.theme?.('textDecorationThickness', utility.value);
  if (thickness) return { textDecorationThickness: thickness + importantString };
  
  return {};
};

// underline-offset utilities for Tailwind CSS v4.1
// underline-offset-<number>, underline-offset-auto, -underline-offset-<number>, underline-offset-[<value>], underline-offset-(<custom-property>)
export const underlineOffset = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle auto keyword: underline-offset-auto
  if (utility.value === 'auto') {
    return { textUnderlineOffset: 'auto' + importantString };
  }
  
  // Handle negative values: -underline-offset-<number>
  if (utility.negative && utility.value) {
    // Check if it's a numeric value
    const numericValue = parseFloat(utility.value);
    if (!isNaN(numericValue)) {
      return { textUnderlineOffset: `calc(${numericValue}px * -1)` + importantString };
    }
    
    // Handle theme values for negative
    const themeValue = ctx.theme?.('textUnderlineOffset', utility.value);
    if (themeValue) {
      return { textUnderlineOffset: `calc(${themeValue} * -1)` + importantString };
    }
  }
  
  // Handle arbitrary values: underline-offset-[3px], underline-offset-[0.5rem]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { textUnderlineOffset: utility.arbitraryValue + importantString };
  }
  
  // Handle custom properties: underline-offset-(--my-offset)
  if (utility.customProperty && utility.value) {
    return { textUnderlineOffset: `var(${utility.value})` + importantString };
  }
  
  // Handle numeric values: underline-offset-1, underline-offset-2, underline-offset-4, underline-offset-8
  if (isNumberValue(utility.value)) {
    const numericValue = parseFloat(utility.value);
    if (!isNaN(numericValue)) {
      return { textUnderlineOffset: `${utility.negative ? '-' : ''}${utility.value}px` + importantString };
    }
    
    // Try theme values
    const themeValue = ctx.theme?.('textUnderlineOffset', utility.value);
    if (themeValue) {
      return { textUnderlineOffset: themeValue + importantString };
    }
  }
  
  return {};
};