import { isColorValue, isLengthValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";
import { fontSize } from "./font";

/**
 * Unified text utilities handler for Tailwind CSS v4
 * Handles all text-* prefix utilities in one place:
 * - Text colors: text-red-500, text-white, text-[#ff0000]
 * - Font sizes: text-xs, text-sm, text-base, text-lg, text-[14px]
 * - Text alignment: text-left, text-center, text-right, text-justify, text-start, text-end
 * - Text wrapping: text-wrap, text-nowrap, text-balance, text-pretty
 * - Text overflow: text-ellipsis, text-clip, truncate
 */

const textWrapMap: Record<string, string> = {
  'wrap': 'wrap',
  'nowrap': 'nowrap',
  'balance': 'balance',
  'pretty': 'pretty'
};

const textOverflowMap: Record<string, string> = {
  'ellipsis': 'ellipsis',
  'clip': 'clip'
};

const textAlignMap: Record<string, string> = {
  'left': 'left',
  'center': 'center',
  'right': 'right',
  'justify': 'justify',
  'start': 'start',
  'end': 'end'
};

export const text = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';

  // Handle truncate (special case - sets multiple properties)
  if (utility.prefix === 'truncate' && !utility.value) {
    return {
      overflow: 'hidden' + importantString,
      textOverflow: 'ellipsis' + importantString,
      whiteSpace: 'nowrap' + importantString
    };
  }

  // Handle text-wrap values: text-wrap, text-nowrap, text-balance, text-pretty
  if (utility.prefix && utility.value && textWrapMap[utility.value]) {
    return { textWrap: textWrapMap[utility.value] + importantString };
  }

  // Handle text-overflow values: text-ellipsis, text-clip
  if (utility.prefix && utility.value && textOverflowMap[utility.value]) {
    return { textOverflow: textOverflowMap[utility.value] + importantString };
  }

  // Handle text-align values: text-left, text-center, text-right, text-justify, text-start, text-end
  if (utility.prefix && utility.value && textAlignMap[utility.value]) {
    return { textAlign: textAlignMap[utility.value] + importantString };
  }
  
  // Handle font-size values: text-xs, text-sm, text-base, text-lg, etc.
  if (ctx.theme?.('fontSize', utility.value)) {
    return fontSize(utility, ctx);
  }
  
  // Handle arbitrary values (could be color or size): text-[#ff0000], text-[14px]
  if (utility.arbitrary && utility.arbitraryValue) {
    // Check if it looks like a color value
    const value = utility.arbitraryValue;
    if (isColorValue(value)) {
      // Handle color arbitrary values
      return { color: value + importantString };
    }
    // Check if it looks like a size value
    if (isLengthValue(value)) {
      return { fontSize: value + importantString };
    }
    // Default to color for other arbitrary values
    return { color: value + importantString };
  }
  
  // Handle color values: text-red-500, text-white, etc.
  if (utility.value) {
    // Check if it's a color value
    if (isColorValue(utility.value)) {
      // Handle color path like red-500 -> red.500
      const colorPath = utility.value.replace(/-/g, '.');
      const color = ctx.config?.(`theme.colors.${colorPath}`);
      if (color) {
        return { color: color + importantString };
      }
    }
    
    // Handle direct color values like white, black
    const directColor = ctx.config?.(`theme.colors.${utility.value}`);
    if (directColor) {
      return { color: directColor + importantString };
    }
  }
  
  return {};
}; 