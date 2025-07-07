import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// border (width, color, style)
// "border-2" → { prefix: "border", value: "2", numeric: true } → { borderWidth: "2px" }
// "border-red-500" → { prefix: "border", value: "red-500" } → { borderColor: "#f56565" }
// "border-dashed" → { prefix: "border", value: "dashed" } → { borderStyle: "dashed" }
export const border = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return { borderWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return { borderColor: color + (utility.important ? ' !important' : '') };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return { borderStyle: utility.value + (utility.important ? ' !important' : '') };
  return {};
};

export const borderT = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return { borderTopWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return { borderTopColor: color + (utility.important ? ' !important' : '') };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return { borderTopStyle: utility.value + (utility.important ? ' !important' : '') };
  return {};
};
export const borderB = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return { borderBottomWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return { borderBottomColor: color + (utility.important ? ' !important' : '') };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return { borderBottomStyle: utility.value + (utility.important ? ' !important' : '') };
  return {};
};
export const borderL = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return { borderLeftWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return { borderLeftColor: color + (utility.important ? ' !important' : '') };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return { borderLeftStyle: utility.value + (utility.important ? ' !important' : '') };
  return {};
};
export const borderR = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return { borderRightWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : '') };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return { borderRightColor: color + (utility.important ? ' !important' : '') };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return { borderRightStyle: utility.value + (utility.important ? ' !important' : '') };
  return {};
};
export const borderX = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return {
      borderLeftWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : ''),
      borderRightWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : ''),
    };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return {
      borderLeftColor: color + (utility.important ? ' !important' : ''),
      borderRightColor: color + (utility.important ? ' !important' : ''),
    };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return {
      borderLeftStyle: utility.value + (utility.important ? ' !important' : ''),
      borderRightStyle: utility.value + (utility.important ? ' !important' : ''),
    };
  return {};
};
export const borderY = (utility: ParsedClassToken, ctx: CssmaContext) => {
  if (utility.numeric)
    return {
      borderTopWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : ''),
      borderBottomWidth: (utility.negative ? '-' : '') + utility.value + 'px' + (utility.important ? ' !important' : ''),
    };
  const color = ctx.theme?.('colors', utility.value);
  if (color)
    return {
      borderTopColor: color + (utility.important ? ' !important' : ''),
      borderBottomColor: color + (utility.important ? ' !important' : ''),
    };
  if ([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
  ].includes(utility.value))
    return {
      borderTopStyle: utility.value + (utility.important ? ' !important' : ''),
      borderBottomStyle: utility.value + (utility.important ? ' !important' : ''),
    };
  return {};
};
// ... border-t, border-b, border-l, border-r 등도 필요시 동일 패턴으로 export 