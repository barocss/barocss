// Collection of converters from theme categories to CSS variables (v4 style)
// Each function takes a category theme object and returns Record<string, string>
// Namespace/naming rules aligned with v4

import type { Context, Theme } from './context';
import { isStructureSafeValue, hasCommentDelimiter, hasHtmlEndTagOpener } from './parser';

// Global CSS variable prefix helper
let CSS_VAR_PREFIX = '--bcss-';

function normalizePrefix(prefix: string): string {
  let p = prefix.trim();
  if (!p.startsWith('--')) p = `--${p}`;
  if (!p.endsWith('-')) p = `${p}-`;
  return p;
}

export function setVarPrefix(prefix: string | undefined): void {
  if (typeof prefix !== 'string' || prefix.trim() === '') {
    CSS_VAR_PREFIX = '--bcss-';
    return;
  }
  CSS_VAR_PREFIX = normalizePrefix(prefix);
}

export function getVarName(key: string, ctx?: Context): string {
  const configured = ctx?.config('cssVarPrefix');
  const prefix = typeof configured === 'string' && configured.trim()
    ? normalizePrefix(configured)
    : ctx ? '--bcss-' : CSS_VAR_PREFIX;
  return `${prefix}${key}`;
}

// Aliases for brevity
export const varName = getVarName;
export function v(key: string, ctx?: Context): string { return getVarName(key, ctx); }

function escapeKey(key: string): string {
  return key.replace('.', '\\.');
}

/**
 * colors: { blue: { 500: '#123456' }, red: { 500: '#ff0000' } }
 * → { '--color-blue-500': '#123456', '--color-red-500': '#ff0000' }
 */
export function colorsToCssVars(colors?: Record<string, unknown>): Record<string, string> {
  if (!colors) return {};
  const result: Record<string, string> = {};
  function walk(obj: Record<string, unknown>, prefix: string[] = []) {
    for (const key in obj) {
      const value = obj[key] as unknown;
      if (typeof value === 'object' && value !== null) {
        walk(value as Record<string, unknown>, [...prefix, key]);
      } else {
        const varName = '--color-' + [...prefix, key].join('-');
        result[varName] = value as string;
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
export function boxShadowToCssVars(boxShadow?: Record<string, unknown>): Record<string, string> {
  if (!boxShadow) return {};
  const result: Record<string, string> = {};
  for (const key in boxShadow) {
    result[`--shadow-${key}`] = boxShadow[key] as string;
  }
  return result;
}

/**
 * fontSize: { xs: ['0.75rem', '1rem'], ... }
 * → { '--text-xs': '0.75rem', '--text-xs--line-height': '1rem' }
 */
/** The line height of a fontSize tuple: `['4rem', '1.1']` or Tailwind's `['4rem', { lineHeight: '1.1' }]` (#300). */
export function fontSizeLineHeight(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const second = value[1] as unknown;
  if (typeof second === 'string' || typeof second === 'number') return String(second);
  const lh = (second as { lineHeight?: unknown } | undefined)?.lineHeight;
  return lh == null ? undefined : String(lh);
}

export function fontSizeToCssVars(fontSize?: Record<string, unknown>): Record<string, string> {
  if (!fontSize) return {};
  const result: Record<string, string> = {};
  for (const key in fontSize) {
    const value = fontSize[key] as unknown;
    if (Array.isArray(value)) {
      result[`--text-${key}`] = value[0] as string;
      const lineHeight = fontSizeLineHeight(value);
      if (lineHeight) result[`--text-${key}--line-height`] = lineHeight;
    } else {
      result[`--text-${key}`] = value as string;
    }
  }
  // console.log('[fontSizeToCssVars] result', result);
  return result;
}

/**
 * fontWeight: { normal: '400', ... }
 * → { '--font-weight-normal': '400' }
 */
export function fontWeightToCssVars(fontWeight?: Record<string, unknown>): Record<string, string> {
  if (!fontWeight) return {};
  const result: Record<string, string> = {};
  for (const key in fontWeight) {
    result[`--font-weight-${key}`] = fontWeight[key] as string;
  }
  return result;
}

/**
 * fontFamily: { sans: ['ui-sans-serif', ...], ... }
 * → { '--font-sans-0': 'ui-sans-serif', ... }
 */
export function fontFamilyToCssVars(fontFamily?: Record<string, unknown>): Record<string, string> {
  if (!fontFamily) return {};
  const result: Record<string, string> = {};
  for (const key in fontFamily) {
    const value = fontFamily[key] as unknown;
    if (Array.isArray(value)) {
      result[`--font-${key}`] = value.join(', ');
    } else {
      result[`--font-${key}`] = value as string;
    }
  }
  return result;
}

/**
 * letterSpacing: { tight: '0.05em', ... }
 * → { '--letter-spacing-tight': '0.05em' }
 */
export function letterSpacingToCssVars(letterSpacing?: Record<string, unknown>): Record<string, string> {
  if (!letterSpacing) return {};
  const result: Record<string, string> = {};
  for (const key in letterSpacing) {
    result[`--letter-spacing-${key}`] = letterSpacing[key] as string;
  }
  return result;
}

/**
 * spacing: { 0: '0px', 1: '0.25rem', ... }
 * → { '--spacing-0': '0px', '--spacing-1': '0.25rem', ... }
 */
export function spacingToCssVars(spacing?: Record<string, unknown>): Record<string, string> {
  if (!spacing) return {};
  const result: Record<string, string> = {};
  for (const key in spacing) {
    result[`--spacing-${escapeKey(key)}`] = spacing[key] as string;
  }
  return result;
}

/**
 * borderRadius: { xl: '0.75rem', ... }
 * → { '--radius-xl': '0.75rem' }
 */
export function borderRadiusToCssVars(borderRadius?: Record<string, unknown>): Record<string, string> {
  if (!borderRadius) return {};
  const result: Record<string, string> = {};
  for (const key in borderRadius) {
    result[`--radius-${escapeKey(key)}`] = borderRadius[key] as string;
  }
  return result;
}

/**
 * zIndex: { 10: '10', ... }
 * → { '--z-10': '10' }
 */
export function zIndexToCssVars(zIndex?: Record<string, unknown>): Record<string, string> {
  if (!zIndex) return {};
  const result: Record<string, string> = {};
  for (const key in zIndex) {
    result[`--z-${escapeKey(key)}`] = String(zIndex[key] as number);
  }
  return result;
}

/**
 * opacity: { 50: '0.5', ... }
 * → { '--opacity-50': '0.5' }
 */
export function opacityToCssVars(opacity?: Record<string, unknown>): Record<string, string> {
  if (!opacity) return {};
  const result: Record<string, string> = {};
  for (const key in opacity) {
    result[`--opacity-${escapeKey(key)}`] = String(opacity[key] as number);
  }
  return result;
}

/**
 * animations: { spin: 'spin 1s linear infinite', ... }
 * → { '--animate-spin': 'spin 1s linear infinite' }
 */
export function animationToCssVars(animations?: Record<string, unknown>): Record<string, string> {
  if (!animations) return {};
  const result: Record<string, string> = {};
  for (const key in animations) {
    result[`--animate-${escapeKey(key)}`] = animations[key] as string;
  }
  return result;
}

/**
 * keyframes: { spin: { 'to': { transform: 'rotate(360deg)' } }, ... }
 * → Requires separate @keyframes block generation (variable conversion omitted here)
 */
export function keyframesToCss(keyframes?: Record<string, unknown>): string {
  if (!keyframes) return '';
  let css = '';
  for (const name in keyframes) {
    const frames = keyframes[name] as unknown;
    css += `@keyframes ${name} {\n`;
    for (const step in frames as Record<string, unknown>) {
      css += `  ${step} {`;
      const props = (frames as Record<string, unknown>)[step] as Record<string, unknown>;
      for (const prop in props) {
        css += ` ${prop}: ${props[prop] as string};`;
      }
      css += ' }\n';
    }
    css += '}\n';
  }
  return css;
}

const COMMENT_OR_BLOCK = /\/\*|\*\/|[{};]|<\//; // #323: also a markup end-tag opener

/** #274: one `@keyframes` block in Tailwind's layout, or '' when a name/step/declaration could break out of it (#273). */
export function keyframesBlock(name: string, frames: unknown): string {
  if (!name || COMMENT_OR_BLOCK.test(name) || /\s/.test(name) || !frames || typeof frames !== 'object') return '';
  let body = '';
  for (const [step, props] of Object.entries(frames as Record<string, unknown>)) {
    if (COMMENT_OR_BLOCK.test(step) || !props || typeof props !== 'object') return '';
    let decls = '';
    for (const [prop, value] of Object.entries(props as Record<string, unknown>)) {
      const v = String(value);
      if (COMMENT_OR_BLOCK.test(prop) || COMMENT_OR_BLOCK.test(v)) return '';
      decls += `    ${prop}: ${v};\n`;
    }
    body += `  ${step} {\n${decls}  }\n`;
  }
  return `@keyframes ${name} {\n${body}}`;
}

/**
 * #274: the `@keyframes` blocks generated CSS needs: every theme keyframes name that an `animation` /
 * `animation-name` declaration mentions, directly or through a theme `var(--animate-*)`.
 */
export function referencedKeyframes(css: string, ctx: Context): string[] {
  if (!css.includes('animation')) return [];
  const all = ctx.theme('keyframes') as Record<string, unknown> | undefined;
  if (!all || typeof all !== 'object') return [];
  const names = new Set<string>();
  for (const m of css.matchAll(/(?:^|[\s;{])animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    const value = m[1].replace(/var\(--animate-([\w-]+)\)/g, (whole, key: string) => {
      const v = ctx.theme('animations', key) ?? ctx.theme('animation', key);
      return typeof v === 'string' ? v : whole;
    });
    for (const word of value.split(/[\s,()]+/)) {
      if (word && Object.prototype.hasOwnProperty.call(all, word)) names.add(word);
    }
  }
  return [...names].map((n) => keyframesBlock(n, all[n])).filter(Boolean);
}

/**
 * transition: { duration: '150ms', ... }
 * → { '--transition-duration': '150ms' }
 */
export function transitionTimingFunctionToCssVars(transition: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in transition) {

    if (key === 'DEFAULT') {
      result[`--default-transition-timing-function`] = transition[key];
    } else {
      result[`--transition-timing-function-${escapeKey(key)}`] = transition[key];
      // Tailwind v4 names: --ease-in / --ease-out / --ease-in-out (ease-linear uses a literal `linear`).
      if (key !== 'linear') result[`--ease-${escapeKey(key)}`] = transition[key];
    }
  }
  return result;
}

/**
 * transitionDuration: { DEFAULT: '150ms', ... }
 * → { '--default-transition-duration': '150ms' }
 */
export function transitionDurationToCssVars(transitionDuration: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in transitionDuration) {
    if (key === 'DEFAULT') {
      result[`--default-transition-duration`] = transitionDuration[key];
    } else {
      result[`--transition-duration-${escapeKey(key)}`] = transitionDuration[key];
    }
  }
  return result;
}


/**
 * transitionDelay: { DEFAULT: '0ms', ... }
 * → { '--default-transition-delay': '0ms' }
 */
export function transitionDelayToCssVars(transitionDelay: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in transitionDelay) {
    if (key === 'DEFAULT') {
      result[`--default-transition-delay`] = transitionDelay[key];
    } else {
      result[`--transition-delay-${escapeKey(key)}`] = transitionDelay[key];
    }
  } 
  return result;
}

/**
 * blur: { DEFAULT: '0px', ... }
 * → { '--default-blur': '0px' }
 */
export function blurToCssVars(blur: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in blur) {
    if (key === 'DEFAULT') {
      result[`--default-blur`] = blur[key];
    } else {
      result[`--blur-${escapeKey(key)}`] = blur[key];
    }
  }
  return result;
}

/**
 * container: { 1: '1rem', ... }
 * → { '--container-1': '1rem' }
 */
export function containerToCssVars(container: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in container) {
    result[`--container-${escapeKey(key)}`] = container[key];
  }
  return result;
}

/**
 * themeToCssVarsAll: merge CSS variables from major theme categories
 */
export function themeToCssVarsAll(theme: Theme): Record<string, string> {
  return {
    ...colorsToCssVars(theme.colors! as Record<string, unknown>),
    ...boxShadowToCssVars(theme.boxShadow! as Record<string, unknown>),
    ...fontSizeToCssVars(theme.fontSize! as Record<string, unknown>),
    ...fontWeightToCssVars(theme.fontWeight! as Record<string, unknown>),
    ...fontFamilyToCssVars(theme.fontFamily! as Record<string, unknown>),
    ...letterSpacingToCssVars(theme.letterSpacing! as Record<string, unknown>),
    '--spacing': (theme.spacing! as Record<string, unknown>)['1'] as string,
    ...spacingToCssVars(theme.spacing! as Record<string, unknown>),
    ...containerToCssVars(theme.container! as Record<string, string>),
    ...borderRadiusToCssVars(theme.borderRadius! as Record<string, unknown>),
    // #344: borderWidth keys as --border-width-* (Tailwind 4.3.3), read by border-*/divide-* utilities.
    ...Object.fromEntries(Object.entries((theme.borderWidth ?? {}) as Record<string, string>).filter(([k]) => k !== 'DEFAULT').map(([k, v]) => [`--border-width-${escapeKey(k)}`, String(v)])),
    ...zIndexToCssVars(theme.zIndex! as Record<string, unknown>),
    ...opacityToCssVars(theme.opacity! as Record<string, unknown>),
    ...animationToCssVars({ ...(theme.animations as Record<string, unknown>), ...(theme.animation as Record<string, unknown>) }),
    ...transitionTimingFunctionToCssVars(theme.transitionTimingFunction! as Record<string, string>),
    ...transitionDurationToCssVars(theme.transitionDuration! as Record<string, string>),
    ...transitionDelayToCssVars(theme.transitionDelay! as Record<string, string>),
    ...blurToCssVars(theme.blur! as Record<string, string>),
    ...Object.fromEntries(Object.entries((theme.textShadow ?? {}) as Record<string, string>).map(([k, v]) => [`--text-shadow-${escapeKey(k)}`, v])),
    ...Object.fromEntries(Object.entries((theme.dropShadow ?? {}) as Record<string, string>).map(([k, v]) => [`--drop-shadow-${escapeKey(k)}`, v])),
    ...Object.fromEntries(Object.entries((theme.aspect ?? {}) as Record<string, string>).map(([k, v]) => [`--aspect-${escapeKey(k)}`, v])),
    // keyframes handled separately
  };
}

/**
 * #260: a theme value that points at its own variable (`--color-brand-600: var(--color-brand-600)`,
 * optionally with a fallback) is cyclic. Emitting it on :root would override the site's own definition
 * with an invalid value, so the root var is skipped; utilities still reference the var.
 */
export function isSelfReferencingVar(name: string, value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = /^var\(\s*(--[\w-]+)\s*(?:,[\s\S]*)?\)$/.exec(value.trim());
  return !!m && m[1] === name.trim();
}

/**
 * toCssVarsBlock: convert Record<string, string> → :root { ... } CSS block string
 */
// #323: a custom-property name is `--` plus word characters and hyphens; `\.` is the only escape the
// theme converters produce (fractional spacing keys).
const SAFE_VAR_NAME = /^--(?:[\w-]|\\\.)+$/;

/**
 * #323: true when one theme variable can be printed as `name: value;` inside the :root block without
 * changing the block's structure. Theme config may come from an untrusted source, so a name must be a plain
 * custom-property ident and a value must be structure-safe and comment-free.
 */
export function isSafeThemeVar(name: unknown, value: unknown): boolean {
  if (typeof name !== 'string' || !SAFE_VAR_NAME.test(name) || hasHtmlEndTagOpener(name)) return false;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const v = String(value);
  return v.trim() !== '' && isStructureSafeValue(v) && !hasCommentDelimiter(v) && !hasHtmlEndTagOpener(v);
}

export function toCssVarsBlock(vars: Record<string, string>, extra: string = ''): string {
  return ':root,:host {\n' + Object.entries(vars).filter(([k, v]) => isSafeThemeVar(k, v) && !isSelfReferencingVar(k, v)).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n' + extra + '\n';
}

// Presets write their internal composite variables as `--baro-*` (--baro-shadow, --baro-ring-shadow,
// --baro-translate-x, --baro-border-style, ...). A configured `cssVarPrefix` renames them in the generated
// AST, so a runtime next to a Tailwind build can set `cssVarPrefix: 'tw'` and compose with the build's
// `--tw-*` composites (#222). Unset, empty or 'baro' leaves the output untouched.
const BARO_VAR = /--baro-/g;
const PREFIXED_KEYS = new Set(['prop', 'value', 'params', 'selector', 'nodes', 'items']);

export function applyVarPrefix<T>(ast: T, ctx?: Context): T {
  const configured = ctx?.config('cssVarPrefix');
  if (typeof configured !== 'string' || !configured.trim()) return ast;
  const prefix = normalizePrefix(configured);
  if (prefix === '--baro-') return ast;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return node.includes('--baro-') ? node.replace(BARO_VAR, prefix) : node;
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(node)) out[k] = PREFIXED_KEYS.has(k) ? walk(val) : val;
    return out;
  };
  return walk(ast) as T;
}
