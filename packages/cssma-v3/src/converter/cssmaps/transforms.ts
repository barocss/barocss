import type { ParsedClassToken } from "../../parser/utils";
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

/**
 * Transform utilities for Tailwind CSS v4
 * Handles CSS transforms: translate, rotate, scale, skew, perspective, backface-visibility
 */

// transform-origin
export const origin = (utility: ParsedClassToken) => ({ 
  transformOrigin: utility.value + (utility.important ? ' !important' : '') 
});

// transform
export const transform = (utility: ParsedClassToken) => ({ 
  transform: utility.value + (utility.important ? ' !important' : '') 
});

// transform-origin
export const transformOrigin = (utility: ParsedClassToken) => ({ 
  transformOrigin: utility.value + (utility.important ? ' !important' : '') 
});

// transform-style
export const transformStyle = (utility: ParsedClassToken) => ({ 
  transformStyle: utility.value + (utility.important ? ' !important' : '') 
});

// translate
export const translate = (utility: ParsedClassToken) => ({ 
  transform: `translate(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-x
export const translateX = (utility: ParsedClassToken) => ({ 
  transform: `translateX(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-y
export const translateY = (utility: ParsedClassToken) => ({ 
  transform: `translateY(${utility.value})` + (utility.important ? ' !important' : '') 
});

// translate-z
export const translateZ = (utility: ParsedClassToken) => ({ 
  transform: `translateZ(${utility.value})` + (utility.important ? ' !important' : '') 
});

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