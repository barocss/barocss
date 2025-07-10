import { isLengthValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// direction: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 's' | 'e' | 'ss' | 'se' | 'es' | 'ee'
function getRadiusValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  // custom property
  if (utility.customProperty && utility.value) {
    return `var(${utility.value.replace("length:", "")})`;
  }
  // theme value
  if (utility.value) {
    const radius = ctx.theme?.("borderRadius", utility.value);
    if (radius) return radius;
  }
  // 기본값
  if (!utility.value && !utility.arbitrary && !utility.customProperty) {
    return "0.25rem";
  }
  return undefined;
}

function makeRadiusResult(direction: string, value: string | undefined, important: boolean) {
  if (!value) return undefined;
  const v = value + (important ? " !important" : "");
  switch (direction) {
    case 'all':
      return { borderRadius: v };
    case 'top':
      return { borderTopLeftRadius: v, borderTopRightRadius: v };
    case 'bottom':
      return { borderBottomLeftRadius: v, borderBottomRightRadius: v };
    case 'left':
      return { borderTopLeftRadius: v, borderBottomLeftRadius: v };
    case 'right':
      return { borderTopRightRadius: v, borderBottomRightRadius: v };
    case 'tl':
      return { borderTopLeftRadius: v };
    case 'tr':
      return { borderTopRightRadius: v };
    case 'bl':
      return { borderBottomLeftRadius: v };
    case 'br':
      return { borderBottomRightRadius: v };
    case 's':
      return { borderStartStartRadius: v, borderEndStartRadius: v };
    case 'e':
      return { borderStartEndRadius: v, borderEndEndRadius: v };
    case 'ss':
      return { borderStartStartRadius: v };
    case 'se':
      return { borderStartEndRadius: v };
    case 'es':
      return { borderEndStartRadius: v };
    case 'ee':
      return { borderEndEndRadius: v };
    default:
      return undefined;
  }
}

export function rounded(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('all', v, utility.important);
}
export function roundedS(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('s', v, utility.important);
}
export function roundedE(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('e', v, utility.important);
}
export function roundedT(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('top', v, utility.important);
}
export function roundedB(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('bottom', v, utility.important);
}
export function roundedL(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('left', v, utility.important);
}
export function roundedR(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('right', v, utility.important);
}
export function roundedTl(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('tl', v, utility.important);
}
export function roundedTr(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('tr', v, utility.important);
}
export function roundedBl(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('bl', v, utility.important);
}
export function roundedBr(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('br', v, utility.important);
}
export function roundedSs(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('ss', v, utility.important);
}
export function roundedSe(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('se', v, utility.important);
}
export function roundedEs(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('es', v, utility.important);
}
export function roundedEe(utility: ParsedClassToken, ctx: CssmaContext) {
  const v = getRadiusValue(utility, ctx);
  return makeRadiusResult('ee', v, utility.important);
}
