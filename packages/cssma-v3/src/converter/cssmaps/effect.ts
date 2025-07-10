import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// effect (shadow, opacity 등)
// shadow, inset-shadow 모두 Tailwind 규칙에 맞게 분리

function getShadowValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // shadow-none
  if (utility.value === 'none') return { boxShadow: '0 0 #0000' };
  // shadow-inherit/current/transparent
  if (utility.value === 'inherit' || utility.value === 'current' || utility.value === 'transparent') {
    return { ['--tw-shadow-color']: utility.value === 'current' ? 'currentColor' : utility.value };
  }
  // theme color
  const color = ctx.theme?.('colors', utility.value);
  if (color) return { ['--tw-shadow-color']: color };
  // shadow-(color:<custom-property>)
  if (utility.customProperty && utility.value?.startsWith('color:')) {
    const prop = utility.value.replace('color:', '');
    return { ['--tw-shadow-color']: `var(${prop})` };
  }
  // shadow-(<custom-property>)
  if (utility.customProperty && utility.value) {
    return { boxShadow: `var(${utility.value})` };
  }
  // shadow-[<arbitrary>]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { boxShadow: utility.arbitraryValue };
  }
  // shadow-*
  if (utility.value) {
    // theme boxShadow
    const themeVal = ctx.theme?.('boxShadow', utility.value);
    if (themeVal) return { boxShadow: themeVal };
    // fallback
    return { boxShadow: utility.value };
  }
  return {};
}

function getInsetShadowValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // inset-shadow-none
  if (utility.value === 'none') return { boxShadow: '0 0 #0000' };
  // inset-shadow-(<custom-property>)
  if (utility.customProperty && utility.value) {
    return { boxShadow: `inset var(${utility.value})` };
  }
  // inset-shadow-[<arbitrary>]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { boxShadow: `inset ${utility.arbitraryValue}` };
  }
  // theme insetBoxShadow
  if (utility.value) {
    const themeVal = ctx.theme?.('insetBoxShadow', utility.value);
    if (themeVal) return { boxShadow: themeVal };
    // fallback
    return { boxShadow: `inset ${utility.value}` };
  }
  return {};
}

function getOpacityValue(utility: ParsedClassToken, ctx: CssmaContext) {
  // opacity-(<custom-property>)
  if (utility.customProperty && utility.value) {
    return `var(${utility.value})`;
  }
  // opacity-[<arbitrary>]
  if (utility.arbitrary && utility.arbitraryValue) {
    return utility.arbitraryValue;
  }
  // theme value (opacity-50 → 0.5)
  const themeVal = ctx.theme?.('opacity', utility.value);
  if (themeVal !== undefined) return themeVal;
  // fallback (opacity-80 → 80%)
  if (utility.value && isNumberValue(utility.value)) {
    return String(Number(utility.value) / 100);
  }
  // fallback (raw value)
  if (utility.value) return utility.value;
  return undefined;
}

export const shadow = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const result = getShadowValue(utility, ctx);
  const imp = utility.important ? ' !important' : '';
  if ('boxShadow' in result && typeof result.boxShadow === 'string') {
    return { ...result, boxShadow: result.boxShadow + imp };
  }
  return result;
};

export const insetShadow = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const result = getInsetShadowValue(utility, ctx);
  const imp = utility.important ? ' !important' : '';
  if ('boxShadow' in result && typeof result.boxShadow === 'string') {
    return { ...result, boxShadow: result.boxShadow + imp };
  }
  return result;
};

export const opacity = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const val = getOpacityValue(utility, ctx);
  if (val === undefined) return {};
  return { opacity: val + (utility.important ? ' !important' : '') };
}; 