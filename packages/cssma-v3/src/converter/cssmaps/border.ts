import { isColorValue, isLengthValue, isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

/**
 * TailwindCSS v4.1 border-collapse utilities
 * https://tailwindcss.com/docs/border-collapse
 *
 * Supported classes:
 * - border-collapse   → border-collapse: collapse;
 * - border-separate   → border-collapse: separate;
 * - !important modifier
 *
 * [참고]
 * - https://tailwindcss.com/docs/border-collapse
 */

const borderCollapseMap: Record<string, string> = {
  'collapse': 'collapse',
  'separate': 'separate',
};

export function borderCollapse(utility: ParsedClassToken) {
  const important = utility.important ? ' !important' : '';
  if (utility.value && borderCollapseMap[utility.value]) {
    return { borderCollapse: borderCollapseMap[utility.value] + important };
  }
  if (utility.value) {
    return { borderCollapse: utility.value + important };
  }
  return undefined;
}

const BORDER_STYLES = [
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'none',
  'groove', 'ridge', 'inset', 'outset'
] as const;

// direction: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'inline' | 'block' | 'inlineStart' | 'inlineEnd'
function getBorderValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    const value = utility.arbitraryValue;
    if (isLengthValue(value)) return { type: 'width', value };
    if (isColorValue(value)) return { type: 'color', value };
    if (BORDER_STYLES.includes(value as any)) return { type: 'style', value };
    if (isNumberValue(value)) return { type: 'width', value: value + 'px' };
    return { type: 'width', value };
  }
  // custom property
  if (utility.customProperty && utility.value) {
    let v = utility.value.replace("length:", "");
    return { type: 'width', value: `var(${v})` };
  }
  // numeric
  if (utility.numeric) {
    const v = (utility.negative ? '-' : '') + utility.value + 'px';
    return { type: 'width', value: v };
  }
  // zero
  if (utility.value === '0') {
    return { type: 'width', value: '0' };
  }
  // theme color
  const color = ctx.theme?.('colors', utility.value);
  if (color) return { type: 'color', value: color };
  // style
  if (BORDER_STYLES.includes(utility.value as any)) {
    return { type: 'style', value: utility.value };
  }
  // fallback: no value (for 'border' only)
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return { type: 'width', value: '1px' };
  }
  return undefined;
}

function makeBorderResult(direction: string, type: 'width' | 'color' | 'style' | string, value: string, important: boolean) {
  const imp = important ? ' !important' : '';
  const v = value + imp;
  switch (direction) {
    case 'all':
      if (type === 'width') return { borderWidth: v };
      if (type === 'color') return { borderColor: v };
      if (type === 'style') return { borderStyle: v };
      break;
    case 'top':
      if (type === 'width') return { borderTopWidth: v };
      if (type === 'color') return { borderTopColor: v };
      if (type === 'style') return { borderTopStyle: v };
      break;
    case 'bottom':
      if (type === 'width') return { borderBottomWidth: v };
      if (type === 'color') return { borderBottomColor: v };
      if (type === 'style') return { borderBottomStyle: v };
      break;
    case 'left':
      if (type === 'width') return { borderLeftWidth: v };
      if (type === 'color') return { borderLeftColor: v };
      if (type === 'style') return { borderLeftStyle: v };
      break;
    case 'right':
      if (type === 'width') return { borderRightWidth: v };
      if (type === 'color') return { borderRightColor: v };
      if (type === 'style') return { borderRightStyle: v };
      break;
    case 'inline':
      if (type === 'width') return { borderInlineWidth: v };
      if (type === 'color') return { borderInlineColor: v };
      if (type === 'style') return { borderInlineStyle: v };
      break;
    case 'block':
      if (type === 'width') return { borderBlockWidth: v };
      if (type === 'color') return { borderBlockColor: v };
      if (type === 'style') return { borderBlockStyle: v };
      break;
    case 'inlineStart':
      if (type === 'width') return { borderInlineStartWidth: v };
      if (type === 'color') return { borderInlineStartColor: v };
      if (type === 'style') return { borderInlineStartStyle: v };
      break;
    case 'inlineEnd':
      if (type === 'width') return { borderInlineEndWidth: v };
      if (type === 'color') return { borderInlineEndColor: v };
      if (type === 'style') return { borderInlineEndStyle: v };
      break;
  }
  return {};
}

export const border = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('all', res.type, res.value, utility.important);
};
export const borderT = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('top', res.type, res.value, utility.important);
};
export const borderB = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('bottom', res.type, res.value, utility.important);
};
export const borderL = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('left', res.type, res.value, utility.important);
};
export const borderR = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('right', res.type, res.value, utility.important);
};
export const borderX = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('inline', res.type, res.value, utility.important);
};
export const borderY = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('block', res.type, res.value, utility.important);
};
export const borderS = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('inlineStart', res.type, res.value, utility.important);
};
export const borderE = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const res = getBorderValue(utility, ctx);
  if (!res) return {};
  return makeBorderResult('inlineEnd', res.type, res.value, utility.important);
}; 