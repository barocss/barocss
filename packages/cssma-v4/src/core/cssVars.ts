// 카테고리별 theme → CSS 변수 변환 함수 모음 (Tailwind v4 스타일)
// 각 함수는 해당 카테고리의 theme 객체를 받아 Record<string, string> 반환
// 네임스페이스/네이밍 규칙은 Tailwind v4와 동일하게 적용

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
 * → { '--text-xs': '0.75rem', '--text-xs-line-height': '1rem' }
 */
export function fontSizeToCssVars(fontSize: Record<string, string | [string, string]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in fontSize) {
    const value = fontSize[key];
    if (Array.isArray(value)) {
      result[`--text-${key}`] = value[0];
      if (value[1]) result[`--text-${key}-line-height`] = value[1];
    } else {
      result[`--text-${key}`] = value;
    }
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
 * → 별도 @keyframes 블록 생성 필요 (여기서는 변수 변환은 생략)
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
 * themeToCssVarsAll: theme 객체에서 주요 카테고리별로 CSS 변수 모두 합치기
 */
export function themeToCssVarsAll(theme: CssmaTheme): Record<string, string> {
  return {
    ...colorsToCssVars(theme.colors || {}),
    ...boxShadowToCssVars(theme.boxShadow || {}),
    ...fontSizeToCssVars(theme.fontSize || {}),
    ...fontFamilyToCssVars(theme.fontFamily || {}),
    '--spacing': theme.spacing['4'],
    ...spacingToCssVars(theme.spacing || {}),
    ...borderRadiusToCssVars(theme.borderRadius || {}),
    ...zIndexToCssVars(theme.zIndex || {}),
    ...opacityToCssVars(theme.opacity || {}),
    ...animationToCssVars(theme.animations || {}),
    // keyframes는 별도
  };
}

/**
 * toCssVarsBlock: Record<string, string> → :root { ... } CSS 블록 문자열로 변환
 */
export function toCssVarsBlock(vars: Record<string, string>, extra: string = ''): string {
  return ':root {\n' + Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n' + extra + '\n}';
} 