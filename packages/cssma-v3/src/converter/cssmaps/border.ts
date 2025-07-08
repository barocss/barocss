import { isColorValue, isLengthValue, isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

const BORDER_STYLES = [
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'none',
  'groove', 'ridge', 'inset', 'outset'
] as const;

// border (width, color, style)
// "border-2" → { prefix: "border", value: "2", numeric: true } → { borderWidth: "2px" }
// "border-red-500" → { prefix: "border", value: "red-500" } → { borderColor: "#f56565" }
// "border-dashed" → { prefix: "border", value: "dashed" } → { borderStyle: "dashed" }
// "border" → { prefix: "border", value: "" } → { borderWidth: "1px" }
// "border-[3px]" → { prefix: "border", arbitrary: true, arbitraryValue: "3px" } → { borderWidth: "3px" }
export const border = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  // Handle no value (border) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-[3px] or border-[#123456] or border-[solid]
  if (utility.arbitrary && utility.arbitraryValue) {
    // Try to determine if it's a width, color, or style
    const value = utility.arbitraryValue;
    
    // If it looks like a length (contains px, rem, em, etc.) - treat as width
    if (isLengthValue(value)) {
      return { borderWidth: value + importantString };
    }
    // If it looks like a color (starts with #, rgb, hsl, etc.) - treat as color
    if (isColorValue(value)) {
      return { borderColor: value + importantString };
    }
    // If it's a known border style - treat as style
    if (BORDER_STYLES.includes(value as any)) {
      return { borderStyle: value + importantString };
    }
    // Default to width for numeric values
    if (isNumberValue(value)) {
      return { borderWidth: value + 'px' + importantString };
    }
    // Otherwise return as-is (could be a custom property or complex value)
    return { borderWidth: value + importantString };
  }

  // Handle custom properties: border-(length:--my-width) or border-(color:--my-color)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    value = `var(${value})` + importantString;
    // Could be width, color, or style - default to width
    return { borderWidth: value };
  }

  // Handle numeric values: border-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderWidth: value + importantString };
  }

  // Handle zero: border-0
  if (utility.value === '0') {
    return { borderWidth: '0' + importantString };
  }

  // Handle theme colors: border-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderColor: color + importantString };
  }

  // Handle border styles: border-solid, border-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderStyle: utility.value + importantString };
  }

  return {};
};

export const borderT = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-t) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderTopWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-t-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    // Try to determine if it's a width, color, or style
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderTopWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderTopColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderTopStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderTopWidth: value + 'px' + importantString };
    }
    return { borderTopWidth: value + importantString };
  }

  // Handle custom properties: border-t-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderTopWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-t-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderTopWidth: value + importantString };
  }

  // Handle zero: border-t-0
  if (utility.value === '0') {
    return { borderTopWidth: '0' + importantString };
  }

  // Handle theme colors: border-t-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderTopColor: color + importantString };
  }

  // Handle border styles: border-t-solid, border-t-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderTopStyle: utility.value + importantString };
  }

  return {};
};

export const borderB = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-b) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderBottomWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-b-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderBottomWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderBottomColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderBottomStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderBottomWidth: value + 'px' + importantString };
    }
    return { borderBottomWidth: value + importantString };
  }

  // Handle custom properties: border-b-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderBottomWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-b-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderBottomWidth: value + importantString };
  }

  // Handle zero: border-b-0
  if (utility.value === '0') {
    return { borderBottomWidth: '0' + importantString };
  }

  // Handle theme colors: border-b-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderBottomColor: color + importantString };
  }

  // Handle border styles: border-b-solid, border-b-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderBottomStyle: utility.value + importantString };
  }

  return {};
};

export const borderL = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-l) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderLeftWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-l-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderLeftWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderLeftColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderLeftStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderLeftWidth: value + 'px' + importantString };
    }
    return { borderLeftWidth: value + importantString };
  }

  // Handle custom properties: border-l-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderLeftWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-l-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderLeftWidth: value + importantString };
  }

  // Handle zero: border-l-0
  if (utility.value === '0') {
    return { borderLeftWidth: '0' + importantString };
  }

  // Handle theme colors: border-l-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderLeftColor: color + importantString };
  }

  // Handle border styles: border-l-solid, border-l-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderLeftStyle: utility.value + importantString };
  }

  return {};
};

export const borderR = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-r) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderRightWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-r-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderRightWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderRightColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderRightStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderRightWidth: value + 'px' + importantString };
    }
    return { borderRightWidth: value + importantString };
  }

  // Handle custom properties: border-r-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderRightWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-r-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderRightWidth: value + importantString };
  }

  // Handle zero: border-r-0
  if (utility.value === '0') {
    return { borderRightWidth: '0' + importantString };
  }

  // Handle theme colors: border-r-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderRightColor: color + importantString };
  }

  // Handle border styles: border-r-solid, border-r-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderRightStyle: utility.value + importantString };
  }

  return {};
};

export const borderX = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-x) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderInlineWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-x-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderInlineWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderInlineColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderInlineStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderInlineWidth: value + 'px' + importantString };
    }
    return { borderInlineWidth: value + importantString };
  }

  // Handle custom properties: border-x-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderInlineWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-x-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderInlineWidth: value + importantString };
  }

  // Handle zero: border-x-0
  if (utility.value === '0') {
    return { borderInlineWidth: '0' + importantString };
  }

  // Handle theme colors: border-x-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderInlineColor: color + importantString };
  }

  // Handle border styles: border-x-solid, border-x-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderInlineStyle: utility.value + importantString };
  }

  return {};
};

export const borderY = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-y) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderBlockWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-y-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    
    if (isLengthValue(value)) {
      return { borderBlockWidth: value + importantString };
    }
    if (isColorValue(value)) {
      return { borderBlockColor: value + importantString };
    }
    if (BORDER_STYLES.includes(value as any)) {
      return { borderBlockStyle: value + importantString };
    }
    if (isNumberValue(value)) {
      return { borderBlockWidth: value + 'px' + importantString };
    }
    return { borderBlockWidth: value + importantString };
  }

  // Handle custom properties: border-y-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderBlockWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-y-2
  if (utility.numeric) {
    const value = (utility.negative ? '-' : '') + utility.value + 'px';
    return { borderBlockWidth: value + importantString };
  }

  // Handle zero: border-y-0
  if (utility.value === '0') {
    return { borderBlockWidth: '0' + importantString };
  }

  // Handle theme colors: border-y-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderBlockColor: color + importantString };
  }

  // Handle border styles: border-y-solid, border-y-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderBlockStyle: utility.value + importantString };
  }

  return {};
};

/**
 * border-s (logical start border-width)
 * border-s → border-inline-start-width: 1px;
 * border-s-2 → border-inline-start-width: 2px;
 */
export const borderS = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-s) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderInlineStartWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-s-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { borderInlineStartWidth: utility.arbitraryValue + importantString };
  }

  // Handle custom properties: border-s-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderInlineStartWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-s-2
  if (utility.numeric && utility.value) {
    const value = utility.negative ? `-${utility.value}px` : `${utility.value}px`;
    return { borderInlineStartWidth: value + importantString };
  }

  // Handle zero: border-s-0
  if (utility.value === '0') {
    return { borderInlineStartWidth: '0' + importantString };
  }

  // Handle theme colors: border-s-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderInlineStartColor: color + importantString };
  }

  // Handle border styles: border-s-solid, border-s-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderInlineStartStyle: utility.value + importantString };
  }

  return {};
};

/**
 * border-e (logical end border-width)
 * border-e → border-inline-end-width: 1px;
 * border-e-2 → border-inline-end-width: 2px;
 */
export const borderE = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle no value (border-e) - default to 1px
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { borderInlineEndWidth: '1px' + importantString };
  }

  // Handle arbitrary values: border-e-[3px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { borderInlineEndWidth: utility.arbitraryValue + importantString };
  }

  // Handle custom properties: border-e-(length:--my-width)
  if (utility.customProperty && utility.value) {
    let value = utility.value.replace("length:", "");
    return { borderInlineEndWidth: `var(${value})` + importantString };
  }

  // Handle numeric values: border-e-2
  if (utility.numeric && utility.value) {
    const value = utility.negative ? `-${utility.value}px` : `${utility.value}px`;
    return { borderInlineEndWidth: value + importantString };
  }

  // Handle zero: border-e-0
  if (utility.value === '0') {
    return { borderInlineEndWidth: '0' + importantString };
  }

  // Handle theme colors: border-e-red-500
  const color = ctx.theme?.('colors', utility.value);
  if (color) {
    return { borderInlineEndColor: color + importantString };
  }

  // Handle border styles: border-e-solid, border-e-dashed, etc.
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { borderInlineEndStyle: utility.value + importantString };
  }

  return {};
};
// ... border-t, border-b, border-l, border-r 등도 필요시 동일 패턴으로 export 