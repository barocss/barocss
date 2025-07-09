import { isLengthValue, isNumberValue, type ParsedClassToken } from "../../parser/utils";
import type { CssmaContext } from "../../theme-types";



/**
 * Font utilities for Tailwind CSS v4
 * Handles font-family, font-size, font-weight, font-style, font-smoothing, font-stretch, font-variant-numeric
 */

// font-family: font-sans, font-serif, font-mono, font-[custom]
export const fontFamily = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax: font-sans, font-serif, font-mono
  const familyMap: Record<string, string> = {
    'font-sans': 'var(--font-sans)',
    'font-serif': 'var(--font-serif)', 
    'font-mono': 'var(--font-mono)'
  };
  
  if (utility.prefix && !utility.value && familyMap[utility.prefix]) {
    return { fontFamily: familyMap[utility.prefix] + importantString };
  }
  
  // Handle arbitrary values: font-[Open_Sans]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { fontFamily: utility.arbitraryValue + importantString };
  }
  
  // Handle custom properties: font-(family:--my-font)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("family:", "");
    return { fontFamily: `var(${value})` + importantString };
  }
  
  // Handle theme values
  const family = ctx.theme?.('fontFamily', utility.value);
  if (family) return { fontFamily: family + importantString };
  
  return {};
};

// font-size: text-xs, text-sm, text-base, text-lg, etc.
export const fontSize = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle arbitrary values: text-[14px]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { fontSize: utility.arbitraryValue + importantString };
  }
  
  // Handle custom properties: text-(size:--my-size)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("size:", "");
    return { fontSize: `var(${value})` + importantString };
  }
  
  // Handle theme values: text-xs, text-sm, text-base, etc.
  const size = ctx.theme?.('fontSize', utility.value);
  if (size) {
    if (typeof size === 'string') {
      return { fontSize: size + importantString };
    }
    // Handle array format [fontSize, lineHeight]
    if (Array.isArray(size)) {
      return { 
        fontSize: size[0] + importantString,
        lineHeight: size[1] + importantString
      };
    }
  }
  
  return {};
};

// font-weight: font-thin, font-light, font-normal, font-medium, font-semibold, font-bold, font-extrabold, font-black
export const fontWeight = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax: font-thin, font-light, etc.
  const weightMap: Record<string, string> = {
    'font-thin': '100',
    'font-extralight': '200',
    'font-light': '300',
    'font-normal': '400',
    'font-medium': '500',
    'font-semibold': '600',
    'font-bold': '700',
    'font-extrabold': '800',
    'font-black': '900'
  };
  
  if (utility.prefix && !utility.value && weightMap[utility.prefix]) {
    return { fontWeight: weightMap[utility.prefix] + importantString };
  }
  
  // Handle arbitrary values: font-[550]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { fontWeight: utility.arbitraryValue + importantString };
  }
  
  // Handle theme values
  const weight = ctx.theme?.('fontWeight', utility.value);
  if (weight) return { fontWeight: weight + importantString };
  
  return {};
};

// font-style: italic, not-italic, font-style-[oblique]
export const fontStyle = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax: italic, not-italic
  const styleMap: Record<string, string> = {
    'italic': 'italic',
    'not-italic': 'normal'
  };
  
  if (utility.prefix && !utility.value && styleMap[utility.prefix]) {
    return { fontStyle: styleMap[utility.prefix] + importantString };
  }
  
  // Handle arbitrary values: font-style-[oblique]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { fontStyle: utility.arbitraryValue + importantString };
  }
  
  return {};
};

// font-smoothing: antialiased, subpixel-antialiased
export const fontSmoothing = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  // Handle keyword-only syntax: antialiased, subpixel-antialiased
  const smoothingMap: Record<string, Record<string, string>> = {
    'antialiased': {
      '-webkit-font-smoothing': 'antialiased',
      '-moz-osx-font-smoothing': 'grayscale'
    },
    'subpixel-antialiased': {
      '-webkit-font-smoothing': 'auto',
      '-moz-osx-font-smoothing': 'auto'
    }
  };
  
  if (utility.prefix && !utility.value && smoothingMap[utility.prefix]) {
    const styles = smoothingMap[utility.prefix];
    const result: Record<string, string> = {};
    for (const [prop, value] of Object.entries(styles)) {
      result[prop] = value + importantString;
    }
    return result;
  }
  
  return {};
};

const fontStretchMap: Record<string, string> = {  
  'ultra-condensed': 'ultra-condensed',
  'extra-condensed': 'extra-condensed',
  'condensed': 'condensed',
  'semi-condensed': 'semi-condensed',
  'normal': 'normal',
  'semi-expanded': 'semi-expanded',
  'expanded': 'expanded',
  'extra-expanded': 'extra-expanded',
  'ultra-expanded': 'ultra-expanded',  
};

// font-stretch: font-stretch-[condensed]
export const fontStretch = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';

  if (utility.prefix && utility.value && fontStretchMap[utility.value]) {
    return { fontStretch: fontStretchMap[utility.value] + importantString };
  }

  if (utility.prefix && utility.value && isLengthValue(utility.value)) {
    return { fontStretch: utility.value + importantString };
  }
  
  // Handle arbitrary values: font-stretch-[condensed]
  if (utility.arbitrary && utility.arbitraryValue) {
    return { fontStretch: utility.arbitraryValue + importantString };
  }

  if (utility.customProperty && utility.value) {
    const value = utility.value;
    return { fontStretch: `var(${value})` + importantString };
  }
  
  return {};
};


// Handle keyword-only syntax
const variantMap: Record<string, string> = {
  'normal-nums': 'normal',
  'ordinal': 'ordinal',
  'slashed-zero': 'slashed-zero',
  'lining-nums': 'lining-nums',
  'oldstyle-nums': 'oldstyle-nums',
  'proportional-nums': 'proportional-nums',
  'tabular-nums': 'tabular-nums',
  'diagonal-fractions': 'diagonal-fractions',
  'stacked-fractions': 'stacked-fractions'
};

// font-variant-numeric: normal-nums, ordinal, slashed-zero, lining-nums, oldstyle-nums, proportional-nums, tabular-nums, diagonal-fractions, stacked-fractions
export const fontVariantNumeric = (utility: ParsedClassToken) => {
  const importantString = utility.important ? ' !important' : '';
  
  
  if (utility.prefix && !utility.value && variantMap[utility.prefix]) {
    return { fontVariantNumeric: variantMap[utility.prefix] + importantString };
  }
  
  return {};
};

const fontFamilyMap: Record<string, string> = {
  'font-sans': 'var(--font-sans)',
  'font-serif': 'var(--font-serif)',
  'font-mono': 'var(--font-mono)'
};


// Handle font-weight values: font-thin, font-light, font-normal, etc.
const weightMap: Record<string, string> = {
  'thin': '100',
  'extralight': '200',
  'light': '300',
  'normal': '400',
  'medium': '500',
  'semibold': '600',
  'bold': '700',
  'extrabold': '800',
  'black': '900'
};

// font utility (handles font-weight primarily)
export const font = (utility: ParsedClassToken, ctx: CssmaContext) => {
  const importantString = utility.important ? ' !important' : '';

  if (utility.prefix && !utility.value && fontFamilyMap[utility.prefix]) {
    return { fontFamily: fontFamilyMap[utility.prefix] + importantString };
  }
  
  if (utility.value && weightMap[utility.value]) {
    return { fontWeight: weightMap[utility.value] + importantString };
  }
  
  // Handle arbitrary values: font-[550], font-[Open_Sans]
  if (utility.arbitrary && utility.arbitraryValue) {

    if (isNumberValue(utility.arbitraryValue)) {
      return { fontWeight: utility.arbitraryValue + importantString };
    }

    return { fontFamily: utility.arbitraryValue + importantString };
  }

  // Handle custom properties: font-(family-name:--my-font)
  if (utility.customProperty && utility.value) {
    const value = utility.value.replace("family-name:", "");
    return { fontFamily: `var(${value})` + importantString };
  }
  
  // Handle theme values
  const weight = ctx.theme?.('fontWeight', utility.value);
  if (weight) return { fontWeight: weight + importantString };
  
  return {};
}; 