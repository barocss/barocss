import type { ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";

const maskClipMap: Record<string, string> = {
  border: 'border-box',
  padding: 'padding-box',
  content: 'content-box',
  fill: 'fill-box',
  stroke: 'stroke-box',
  view: 'view-box',
};

export function maskClip(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value } = utility;
  const item = maskClipMap[value as keyof typeof maskClipMap];
  if (item) {
    return { maskClip: item + important };
  }
  return undefined;
}

/**
 * TailwindCSS v4.1 mask-origin utility
 * https://tailwindcss.com/docs/mask-origin
 */
const maskOriginMap: Record<string, string> = {
    border: 'border-box',
    padding: 'padding-box',
    content: 'content-box',
    fill: 'fill-box',
    stroke: 'stroke-box',
    view: 'view-box',
  };
export function maskOrigin(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value } = utility;
  const item = maskOriginMap[value as keyof typeof maskOriginMap];
  if (item) {
    return { maskOrigin: item + important };
  }
  return undefined;
}


/**
 * TailwindCSS v4.1 mask-repeat utility
 * https://tailwindcss.com/docs/mask-repeat
 */

const maskRepeatMap = {
  repeat: 'repeat',
  'no-repeat': 'no-repeat',
  space: 'space',
  round: 'round',
};

export function maskRepeat(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value } = utility;

  const item = maskRepeatMap[value as keyof typeof maskRepeatMap];
  if (item) {
    return { maskRepeat: item + important };
  }

  return undefined;
}

/**
 * TailwindCSS v4.1 mask-size utility
 * https://tailwindcss.com/docs/mask-size
 */
export function maskSize(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, arbitrary, arbitraryValue, customProperty } = utility;
  if (customProperty && value) {
    return { maskSize: `var(${value})${important}` };
  }
  if (arbitrary && arbitraryValue) {
    return { maskSize: `${arbitraryValue}${important}` };
  }
  return undefined;
}

/**
 * TailwindCSS v4.1 mask-position utility
 * https://tailwindcss.com/docs/mask-position
 */
export function maskPosition(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, arbitrary, arbitraryValue, customProperty } = utility;
  if (customProperty && value) {
    return { maskPosition: `var(${value})${important}` };
  }
  if (arbitrary && arbitraryValue) {
    return { maskPosition: `${arbitraryValue}${important}` };
  }
  return undefined;
}



/**
 * TailwindCSS v4.1 mask-type utility
 * https://tailwindcss.com/docs/mask-type
 */
const maskTypeMap: Record<string, string> = {
    alpha: 'alpha',
    luminance: 'luminance',
  };
export function maskType(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value } = utility;

  const item = maskTypeMap[value as keyof typeof maskTypeMap];
  if (item) {
    return { maskType: item + important };
  }
  return undefined;
} 

const maskCompositeMap = {
  add: 'add',
  subtract: 'subtract',
  intersect: 'intersect',
  exclude: 'exclude',
};

const maskModeMap = {
  auto: 'auto',
  alpha: 'alpha',
  luminance: 'luminance',
  match: 'match-source',
};

// mask-position 표준 클래스
const maskPositionMap: Record<string, string> = {
  'top-left': 'top left',
  'top': 'top',
  'top-right': 'top right',
  'left': 'left',
  'center': 'center',
  'right': 'right',
  'bottom-left': 'bottom left',
  'bottom': 'bottom',
  'bottom-right': 'bottom right',
};

const maskSizeMap: Record<string, string> = {
  'auto': 'auto',
  'cover': 'cover',
  'contain': 'contain',
};

export function mask(utility: ParsedClassToken, ctx: CssmaContext) {
  const important = utility.important ? ' !important' : '';
  const { value, customProperty, arbitrary, arbitraryValue } = utility;

  if (value === 'none') {
    return { mask: 'none' + important };
  }

  if (value === 'no-repeat') {
    return { maskRepeat: 'no-repeat' + important };
  }
  
  if (value === 'no-clip') {
    return { maskClip: 'no-clip' + important };
  }

  if (maskSizeMap[value]) {
    return { maskSize: maskSizeMap[value] + important };
  }

  if (maskPositionMap[value]) {
    return { maskPosition: maskPositionMap[value] + important };
  }
  // mask-position-(<custom-property>)
  if (customProperty && value) {
    return { maskPosition: `var(${value})${important}` };
  }
  // mask-position-[<arbitrary>]
  if (arbitrary && arbitraryValue) {
    return { maskPosition: `${arbitraryValue}${important}` };
  }

  // 기존 mask-clip, mask-composite, mask-mode 등
  const maskClip = maskClipMap[value as keyof typeof maskClipMap];
  if (maskClip) {
    return { maskClip: maskClip + important };
  }
  const maskComposite = maskCompositeMap[value as keyof typeof maskCompositeMap];
  if (maskComposite) {
    return { maskComposite: maskComposite + important };
  }
  const maskMode = maskModeMap[value as keyof typeof maskModeMap];
  if (maskMode) {
    return { maskMode: maskMode + important };
  }

  // fallback
  return { mask: value + important };
}