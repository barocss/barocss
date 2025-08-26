// Collection of converters from theme categories to CSS variables (v4 style)
// Each function takes a category theme object and returns Record<string, string>
// Namespace/naming rules aligned with v4

import type { CssmaTheme } from './context';

/**
 * colors: { blue: { 500: '#123456' }, red: { 500: '#ff0000' } }
 * → { '--color-blue-500': '#123456', '--color-red-500': '#ff0000' }
 */
export function colorsToCssVars(colors: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  function walk(obj: any, prefix: string[] = []) {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        walk(value, [...prefix, key]);
      } else {
        const varName = '--color-' + [...prefix, key].join('-');
        result[varName] = value;
      }
    }
  }
  walk(colors);
  return result;
}

/**
 * boxShadow: { lg: '0 10px 15px ...', ... }
 * → { '--shadow-lg': '...' }
 */
export function boxShadowToCssVars(boxShadow: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in boxShadow) {
    result[`--shadow-${key}`] = boxShadow[key];
  }
  return result;
}

/**
 * fontSize: { xs: ['0.75rem', '1rem'], ... }
 * → { '--text-xs': '0.75rem', '--text-xs--line-height': '1rem' }
 */
export function fontSizeToCssVars(fontSize: Record<string, string | [string, string]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in fontSize) {
    const value = fontSize[key];
    if (Array.isArray(value)) {
      result[`--text-${key}`] = value[0];
      if (value[1]) result[`--text-${key}--line-height`] = value[1];
    } else {
      result[`--text-${key}`] = value;
    }
  }
  console.log('[fontSizeToCssVars] result', result);
  return result;
}

/**
 * fontWeight: { normal: '400', ... }
 * → { '--font-weight-normal': '400' }
 */
export function fontWeightToCssVars(fontWeight: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in fontWeight) {
    result[`--font-weight-${key}`] = fontWeight[key];
  }
  return result;
}

/**
 * fontFamily: { sans: ['ui-sans-serif', ...], ... }
 * → { '--font-sans-0': 'ui-sans-serif', ... }
 */
export function fontFamilyToCssVars(fontFamily: Record<string, string[] | string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in fontFamily) {
    const value = fontFamily[key];
    if (Array.isArray(value)) {
      result[`--font-${key}`] = value.join(', ');
    } else {
      result[`--font-${key}`] = value;
    }
  }
  return result;
}

/**
 * spacing: { 0: '0px', 1: '0.25rem', ... }
 * → { '--spacing-0': '0px', '--spacing-1': '0.25rem', ... }
 */
export function spacingToCssVars(spacing: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in spacing) {
    result[`--spacing-${key}`] = spacing[key];
  }
  return result;
}

/**
 * borderRadius: { xl: '0.75rem', ... }
 * → { '--radius-xl': '0.75rem' }
 */
export function borderRadiusToCssVars(borderRadius: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in borderRadius) {
    result[`--radius-${key}`] = borderRadius[key];
  }
  return result;
}

/**
 * zIndex: { 10: '10', ... }
 * → { '--z-10': '10' }
 */
export function zIndexToCssVars(zIndex: Record<string, string | number>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in zIndex) {
    result[`--z-${key}`] = String(zIndex[key]);
  }
  return result;
}

/**
 * opacity: { 50: '0.5', ... }
 * → { '--opacity-50': '0.5' }
 */
export function opacityToCssVars(opacity: Record<string, string | number>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in opacity) {
    result[`--opacity-${key}`] = String(opacity[key]);
  }
  return result;
}

/**
 * animations: { spin: 'spin 1s linear infinite', ... }
 * → { '--animate-spin': 'spin 1s linear infinite' }
 */
export function animationToCssVars(animations: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in animations) {
    result[`--animate-${key}`] = animations[key];
  }
  return result;
}

/**
 * keyframes: { spin: { 'to': { transform: 'rotate(360deg)' } }, ... }
 * → Requires separate @keyframes block generation (variable conversion omitted here)
 */
export function keyframesToCss(keyframes: Record<string, any>): string {
  let css = '';
  for (const name in keyframes) {
    const frames = keyframes[name];
    css += `@keyframes ${name} {\n`;
    for (const step in frames) {
      css += `  ${step} {`;
      const props = frames[step];
      for (const prop in props) {
        css += ` ${prop}: ${props[prop]};`;
      }
      css += ' }\n';
    }
    css += '}\n';
  }
  return css;
}

/**
 * themeToCssVarsAll: merge CSS variables from major theme categories
 */
export function themeToCssVarsAll(theme: CssmaTheme): Record<string, string> {
  return {
    ...colorsToCssVars(theme.colors || {}),
    ...boxShadowToCssVars(theme.boxShadow || {}),
    ...fontSizeToCssVars(theme.fontSize || {}),
    ...fontWeightToCssVars(theme.fontWeight || {}),
    ...fontFamilyToCssVars(theme.fontFamily || {}),
    '--spacing': theme.spacing['1'],
    ...spacingToCssVars(theme.spacing || {}),
    ...borderRadiusToCssVars(theme.borderRadius || {}),
    ...zIndexToCssVars(theme.zIndex || {}),
    ...opacityToCssVars(theme.opacity || {}),
    ...animationToCssVars(theme.animations || {}),
    // keyframes는 별도
  };
}

/**
 * toCssVarsBlock: convert Record<string, string> → :root { ... } CSS block string
 */
export function toCssVarsBlock(vars: Record<string, string>, extra: string = ''): string {
  return ':root {\n' + Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n' + extra + '\n}';
} 