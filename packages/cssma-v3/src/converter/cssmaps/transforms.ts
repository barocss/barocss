import { isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

// Tailwind v4.1 perspective theme variable mapping
const perspectiveThemeMap: Record<string, string> = {
  'dramatic': 'var(--perspective-dramatic)', // 100px
  'near': 'var(--perspective-near)',         // 300px
  'normal': 'var(--perspective-normal)',     // 500px
  'midrange': 'var(--perspective-midrange)', // 800px
  'distant': 'var(--perspective-distant)',   // 1200px
  'none': 'none',
};

// Tailwind v4.1 perspective-origin named values
const perspectiveOriginMap: Record<string, string> = {
  'center': 'center',
  'top': 'top',
  'top-right': 'top right',
  'right': 'right',
  'bottom-right': 'bottom right',
  'bottom': 'bottom',
  'bottom-left': 'bottom left',
  'left': 'left',
  'top-left': 'top left',
};

// Tailwind v4.1 transform-origin named values
const transformOriginMap: Record<string, string> = {
  'center': 'center',
  'top': 'top',
  'top-right': 'top right',
  'right': 'right',
  'bottom-right': 'bottom right',
  'bottom': 'bottom',
  'bottom-left': 'bottom left',
  'left': 'left',
  'top-left': 'top left',
};

/**
 * Transform utilities for Tailwind CSS v4
 * Handles CSS transforms: translate, rotate, scale, skew, perspective, backface-visibility
 */

// origin utility (transform-origin)
export const origin = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  const value = utility.value;
  // named values
  if (value && transformOriginMap[value]) {
    return { transformOrigin: transformOriginMap[value] + important };
  }
  // custom property
  if (utility.customProperty && value) {
    return { transformOrigin: `var(${value})` + important };
  }
  // arbitrary value
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transformOrigin: utility.arbitraryValue + important };
  }
  return undefined;
};

// Tailwind v4.1 transform utility
const transformMap: Record<string, string> = {
  '3d': 'preserve-3d',
  'flat': 'flat',
};


export const transform = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  // transform-style: preserve-3d/flat
  if (utility.value && transformMap[utility.value]) {
    return { transformStyle: transformMap[utility.value] + important };
  }
  // transform-none
  if (utility.value === 'none') {
    return { transform: 'none' + important };
  }
  // transform-gpu
  if (utility.value === 'gpu') {
    return {
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'translate3d(var(--tw-translate-x), var(--tw-translate-y), 0) ' +
        'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
        'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))' + important,
    };
  }
  // transform-cpu
  if (utility.value === 'cpu') {
    return {
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) ' +
        'var(--tw-skew-x) var(--tw-skew-y)' + important,
    };
  }
  // transform-(--custom)
  if (utility.customProperty && utility.value) {
    return { transform: `var(${utility.value})` + important };
  }
  // transform-[arbitrary]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { transform: utility.arbitraryValue + important };
  }
  // default: transform (2D)
  return {
    '--tw-translate-x': '0',
    '--tw-translate-y': '0',
    '--tw-rotate': '0',
    '--tw-skew-x': '0',
    '--tw-skew-y': '0',
    '--tw-scale-x': '1',
    '--tw-scale-y': '1',
    transform:
      'translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) ' +
      'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
      'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))' + important,
  };
};

// translate (both axes)
export const translate = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  const negative = utility.negative ? '-' : '';

  if (utility.arbitraryValue) {
    return { transform: `${utility.arbitraryValue} ${utility.arbitraryValue}` + important };
  }

  if (utility.value === 'px') {
    return { transform: `${negative}1px ${negative}1px` + important };
  }

  if (utility.value === 'full') {
    return { transform: `${negative}100% ${negative}100%` + important };
  }

  // custom property
  if (utility.customProperty && utility.value) {
    return { transform: `var(${utility.value}) var(${utility.value})` + important };
  }

  if (utility.value && utility.slash) {
    const value = Number(utility.value) / Number(utility.slash);
    return { transform: `calc(${value} * ${negative}100%) calc(${value} * ${negative}100%);` + important };
  }

  if (utility.value && isNumberValue(utility.value)) {
    return { transform: `translate: calc(var(--spacing) * ${negative}${utility.value}) calc(var(--spacing) * ${negative}${utility.value});` + important };
  }

  return undefined;
};

// translate-x
export const translateX = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  const negative = utility.negative ? '-' : '';

  if (utility.arbitraryValue) {
    return { transform: `${utility.arbitraryValue} var(--tw-translate-y)` + important };
  }

  if (utility.value === 'px') {
    return { transform: `${negative}1px var(--tw-translate-y)` + important };
  }

  if (utility.value === 'full') {
    return { transform: `${negative}100% var(--tw-translate-y)` + important };
  }

  if (utility.customProperty && utility.value) {
    return { transform: `var(${utility.value}) var(--tw-translate-y)` + important };
  }

  if (utility.value && utility.slash) {
    const value = Number(utility.value) / Number(utility.slash);
    return { transform: `calc(${value} * ${negative}100%) var(--tw-translate-y)` + important };
  }

  if (utility.value && isNumberValue(utility.value)) {
    return { transform: `translateX: calc(var(--spacing) * ${negative}${utility.value});` + important };
  }

  return undefined;
};

// translate-y
export const translateY = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  const negative = utility.negative ? '-' : '';

  if (utility.arbitraryValue) {
    return { transform: `var(--tw-translate-x) ${utility.arbitraryValue}` + important };
  }

  if (utility.value === 'px') {
    return { transform: `var(--tw-translate-x) ${negative}1px` + important };
  }

  if (utility.value === 'full') {
    return { transform: `var(--tw-translate-x) ${negative}100%` + important };
  }

  if (utility.customProperty && utility.value) {
    return { transform: `var(--tw-translate-x) var(${utility.value})` + important };
  }

  if (utility.value && utility.slash) {
    const value = Number(utility.value) / Number(utility.slash);
    return { transform: `var(--tw-translate-x) calc(${value} * ${negative}100%)` + important };
  }

  if (utility.value && isNumberValue(utility.value)) {
    return { transform: `translate: calc(var(--spacing) * ${negative}${utility.value}) var(--tw-translate-y);` + important };
  }

  return undefined;
};

// translate-z
export const translateZ = (utility: ParsedClassToken) => {
  const important = utility.important ? ' !important' : '';
  const negative = utility.negative ? '-' : '';

  if (utility.arbitraryValue) {
    return { transform: `var(--tw-translate-x) var(--tw-translate-y) ${utility.arbitraryValue}` + important };
  }

  if (utility.value === 'px') {
    return { transform: `var(--tw-translate-x) var(--tw-translate-y) ${negative}1px` + important };
  }
  if (utility.value === 'full') {
    return { transform: `var(--tw-translate-x) var(--tw-translate-y) ${negative}100%` + important };
  }

  if (utility.customProperty && utility.value) {
    return { transform: `var(--tw-translate-x) var(--tw-translate-y) var(${utility.value})` + important };
  }

  if (utility.value && utility.slash) {
    const value = Number(utility.value) / Number(utility.slash);
    return { transform: `var(--tw-translate-x) var(--tw-translate-y) calc(${value} * ${negative}100%)` + important };
  }

  if (utility.value && isNumberValue(utility.value)) {
    return { transform: `translateZ: calc(var(--spacing) * ${negative}${utility.value});` + important };
  }

  return undefined;
};

// perspective
export const perspective = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const important = utility.important ? ' !important' : '';
  const value = utility.value;

  // 1. theme() 우선 조회
  if (ctx?.theme && value) {
    const themeVal = ctx.theme('perspective', value);
    if (themeVal) return { perspective: themeVal + important };
  }

  // 2. custom property
  if (utility.customProperty) {
    return { perspective: `var(${value})` + important };
  }

  // 3. 프리셋/매핑
  if (value && perspectiveThemeMap[value]) {
    return { perspective: perspectiveThemeMap[value] + important };
  }

  // 4. arbitrary
  if (utility.arbitrary && utility.arbitraryValue) {
    return { perspective: utility.arbitraryValue + important };
  }

  // 5. none
  if (value === 'none') {
    return { perspective: 'none' + important };
  }

  return undefined;
};

// perspective-origin
export const perspectiveOrigin = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const important = utility.important ? ' !important' : '';
  const value = utility.value;

  // 1. theme() 우선 조회
  if (ctx?.theme && value) {
    const themeVal = ctx.theme('perspectiveOrigin', value);
    if (themeVal) return { perspectiveOrigin: themeVal + important };
  }

  // 2. custom property
  if (utility.customProperty) {
    return { perspectiveOrigin: `var(${value})` + important };
  }

  // 3. 프리셋/매핑
  if (value && perspectiveOriginMap[value]) {
    return { perspectiveOrigin: perspectiveOriginMap[value] + important };
  }

  // 4. arbitrary
  if (utility.arbitrary && utility.arbitraryValue) {
    return { perspectiveOrigin: utility.arbitraryValue + important };
  }

  return undefined;
};

// backface utility (handles backface-hidden, backface-visible, backface-[arbitrary], !important)

const backfaceMap: Record<string, string> = {
  'hidden': 'hidden',
  'visible': 'visible',
};

export const backface = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  if (utility.value && backfaceMap[utility.value]) {
    return {
      backfaceVisibility: backfaceMap[utility.value] + importantString
    };
  }

  return {
    backfaceVisibility:
      (utility?.value || 'visible') +
      importantString
  };
};