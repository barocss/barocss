import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS scale-* 유틸리티 완전 대응
// scale-100, scale-75, -scale-125, scale-x-110, scale-y-90, scale-z-80, scale-3d, scale-none, scale-(--my-scale), scale-[1.7] 등

function getScaleValue(utility: ParsedClassToken, axis: 'x' | 'y' | 'z' | 'all' | '3d' = 'all') {
  // scale-none
  if (utility.value === 'none') return axis === 'all' ? 'none' : undefined;
  // scale-3d
  if (utility.value === '3d' && axis === '3d') return 'var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)';
  // custom property (scale-(--my-scale))
  if (utility.customProperty && utility.value) {
    if (axis === 'all') return `var(${utility.value}) var(${utility.value})`;
    if (axis === 'x') return `var(${utility.value}) var(--tw-scale-y)`;
    if (axis === 'y') return `var(--tw-scale-x) var(${utility.value})`;
    if (axis === 'z') return `var(--tw-scale-x) var(--tw-scale-y) var(${utility.value})`;
    if (axis === '3d') return `var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)`;
  }
  // arbitrary value (scale-[1.7])
  if (utility.arbitrary && utility.arbitraryValue && isNumberValue(utility.arbitraryValue)) {
    if (axis === 'all') return utility.arbitraryValue;
    if (axis === 'x') return `${utility.arbitraryValue} var(--tw-scale-y)`;
    if (axis === 'y') return `var(--tw-scale-x) ${utility.arbitraryValue}`;
    if (axis === 'z') return `var(--tw-scale-x) var(--tw-scale-y) ${utility.arbitraryValue}`;
    if (axis === '3d') return `var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)`;
  }
  // scale-3d
  if (utility.value === '3d' && axis === '3d') return 'var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)';
  // number (scale-110 → 110%)
  if (utility.value && isNumberValue(utility.value)) {
    const v = utility.negative ? `calc(${utility.value}% * -1)` : `${utility.value}%`;
    if (axis === 'all') return `${v} ${v}`;
    if (axis === 'x') return `${v} var(--tw-scale-y)`;
    if (axis === 'y') return `var(--tw-scale-x) ${v}`;
    if (axis === 'z') return `var(--tw-scale-x) var(--tw-scale-y) ${v}`;
  }
  // fallback
  return undefined;
}

export const scale = (utility: ParsedClassToken) => {
  const value = getScaleValue(utility, 'all');
  if (value === undefined) return {};
  return {
    scale: value + (utility.important ? ' !important' : '')
  };
};

export const scaleX = (utility: ParsedClassToken) => {
  const value = getScaleValue(utility, 'x');
  if (value === undefined) return {};
  return {
    scale: value + (utility.important ? ' !important' : '')
  };
};

export const scaleY = (utility: ParsedClassToken) => {
  const value = getScaleValue(utility, 'y');
  if (value === undefined) return {};
  return {
    scale: value + (utility.important ? ' !important' : '')
  };
};

export const scaleZ = (utility: ParsedClassToken) => {
  const value = getScaleValue(utility, 'z');
  if (value === undefined) return {};
  return {
    scale: value + (utility.important ? ' !important' : '')
  };
};

export const scale3d = (utility: ParsedClassToken) => {
  const value = getScaleValue(utility, '3d');
  if (value === undefined) return {};
  return {
    scale: value + (utility.important ? ' !important' : '')
  };
}; 