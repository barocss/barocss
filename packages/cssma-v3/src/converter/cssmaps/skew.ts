import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS skew-* 유틸리티 완전 대응
// skew-4, -skew-10, skew-x-6, -skew-y-12, skew-(--my-skew), skew-[3.142rad] 등

function getSkewValue(utility: ParsedClassToken, axis: 'x' | 'y' | 'all' = 'all') {
  // custom property (skew-(--my-skew))
  if (utility.customProperty && utility.value) {
    if (axis === 'all') return `skewX(var(${utility.value})) skewY(var(${utility.value}))`;
    if (axis === 'x') return `skewX(var(${utility.value}))`;
    if (axis === 'y') return `skewY(var(${utility.value}))`;
  }
  // arbitrary value (skew-[3.142rad])
  if (utility.arbitrary && utility.arbitraryValue) {
    if (axis === 'all') return `skewX(${utility.arbitraryValue}) skewY(${utility.arbitraryValue})`;
    if (axis === 'x') return `skewX(${utility.arbitraryValue})`;
    if (axis === 'y') return `skewY(${utility.arbitraryValue})`;
  }
  // number (skew-4 → 4deg)
  if (utility.value && isNumberValue(utility.value)) {
    const v = utility.negative ? `-${utility.value}` : utility.value;
    if (axis === 'all') return `skewX(${v}deg) skewY(${v}deg)`;
    if (axis === 'x') return `skewX(${v}deg)`;
    if (axis === 'y') return `skewY(${v}deg)`;
  }
  // fallback
  return undefined;
}

export const skew = (utility: ParsedClassToken) => {
  const value = getSkewValue(utility, 'all');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
};

export const skewX = (utility: ParsedClassToken) => {
  const value = getSkewValue(utility, 'x');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
};

export const skewY = (utility: ParsedClassToken) => {
  const value = getSkewValue(utility, 'y');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
}; 