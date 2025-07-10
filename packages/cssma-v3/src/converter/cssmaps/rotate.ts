import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// TailwindCSS rotate-* 유틸리티 완전 대응
// rotate-45, -rotate-90, rotate-x-50, -rotate-y-30, rotate-z-45, rotate-none, rotate-(--my-rotation), rotate-[3.142rad] 등

function getRotateValue(utility: ParsedClassToken, axis: 'x' | 'y' | 'z' | 'all' = 'all') {
  // rotate-none
  if (utility.value === 'none') {
    if (axis === 'all') return 'none';
    if (axis === 'x') return 'rotateX(0deg) var(--tw-rotate-y)';
    if (axis === 'y') return 'var(--tw-rotate-x) rotateY(0deg)';
    if (axis === 'z') return 'var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(0deg)';
  }
  // custom property (rotate-(--my-rotation))
  if (utility.customProperty && utility.value) {
    if (axis === 'all') return `var(${utility.value})`;
    if (axis === 'x') return `rotateX(var(${utility.value})) var(--tw-rotate-y)`;
    if (axis === 'y') return `var(--tw-rotate-x) rotateY(var(${utility.value}))`;
    if (axis === 'z') return `var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(var(${utility.value}))`;
  }
  // arbitrary value (rotate-[3.142rad])
  if (utility.arbitrary && utility.arbitraryValue) {
    if (axis === 'all') return utility.arbitraryValue;
    if (axis === 'x') return `rotateX(${utility.arbitraryValue}) var(--tw-rotate-y)`;
    if (axis === 'y') return `var(--tw-rotate-x) rotateY(${utility.arbitraryValue})`;
    if (axis === 'z') return `var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(${utility.arbitraryValue})`;
  }
  // number (rotate-45 → 45deg)
  if (utility.value && isNumberValue(utility.value)) {
    const v = utility.negative ? `-${utility.value}` : utility.value;
    if (axis === 'all') return `${v}deg`;
    if (axis === 'x') return `rotateX(${v}deg) var(--tw-rotate-y)`;
    if (axis === 'y') return `var(--tw-rotate-x) rotateY(${v}deg)`;
    if (axis === 'z') return `var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(${v}deg)`;
  }
  // fallback
  return undefined;
}

export const rotate = (utility: ParsedClassToken) => {
  const value = getRotateValue(utility, 'all');
  if (value === undefined) return {};
  return {
    rotate: value + (utility.important ? ' !important' : '')
  };
};

export const rotateX = (utility: ParsedClassToken) => {
  const value = getRotateValue(utility, 'x');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
};

export const rotateY = (utility: ParsedClassToken) => {
  const value = getRotateValue(utility, 'y');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
};

export const rotateZ = (utility: ParsedClassToken) => {
  const value = getRotateValue(utility, 'z');
  if (value === undefined) return {};
  return {
    transform: value + (utility.important ? ' !important' : '')
  };
}; 