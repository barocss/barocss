import { AstNode } from "../../core/ast";
import { Context } from "../../core/context";

/**
 * Create container query parameters
 */
export function createContainerParams(type: 'min' | 'max', value: string, name?: string): string {
  const condition = type === 'min' ? 'width >=' : 'width <';
  return name ? `${name} (${condition} ${value})` : `(${condition} ${value})`;
}

/**
 * Create media query parameters
 */
export function createMediaParams(type: 'min' | 'max', value: string): string {
  return type === 'min' ? `(min-width: ${value})` : `(width < ${value})`;
}

/**
 * Get size value from theme
 */
export function getThemeSize(ctx: Context, key: string): string | undefined {
  return ctx.theme('container.' + key) as string || ctx.theme('breakpoint.' + key) as string;
}

/**
 * Create container query AST
 */
export function createContainerRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'container',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
    source: 'container'
  };
}

/**
 * Create media query AST
 */
export function createMediaRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'media',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
  };
}

// Default breakpoint values (fallback)
export function getDefaultBreakpoint(breakpoint: string): string {
  const defaults: Record<string, string> = {
    'sm': '(min-width: 640px)',
    'md': '(min-width: 768px)', 
    'lg': '(min-width: 1024px)',
    'xl': '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)'
  };
  return defaults[breakpoint] || `(min-width: ${breakpoint})`;
}

/**
 * Arbitrary selector value as Tailwind reads it: `_` is a space, `\_` a literal underscore.
 */
export function decodeArbitrarySelector(value: string): string {
  return value.replace(/\\_|_/g, (m) => (m === '_' ? ' ' : '_'));
}

/**
 * `data-[state=open]` / `aria-[expanded=true]` / `data-avatar` → `[data-state="open"]`, as Tailwind emits it.
 * Returns undefined for anything else.
 */
export function attributeVariantSelector(variant: string): string | undefined {
  const bracket = /^(data|aria)-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(variant);
  if (bracket) {
    const [, kind, key, raw] = bracket;
    if (raw === undefined) return `[${kind}-${key}]`;
    const value = /^(["']).*\1$/.test(raw) ? raw : `"${decodeArbitrarySelector(raw)}"`;
    return `[${kind}-${key}=${value}]`;
  }
  const bare = /^data-([a-zA-Z0-9_-]+)$/.exec(variant);
  return bare ? `[data-${bare[1]}]` : undefined;
}

/**
 * The argument of a `:has()`/`:not()` built from an arbitrary value: a selector list is wrapped as `*:is(…)`
 * (Tailwind's form); a relative selector (`>svg`) or a single selector is kept.
 */
export function functionalArgument(value: string): string {
  const v = decodeArbitrarySelector(value);
  return /^[>+~]/.test(v.trim()) || !hasTopLevelComma(v) ? v : `*:is(${v})`;
}

function hasTopLevelComma(value: string): boolean {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') i++;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) return true;
  }
  return false;
}