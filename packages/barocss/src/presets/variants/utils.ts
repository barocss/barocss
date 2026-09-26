import { AstNode, atRule } from "../../core/ast";
import { Context } from "../../core/context";
import { getModifier } from "../../core/registry";

/**
 * Create container query parameters
 */
export function createContainerParams(type: 'min' | 'max', value: string, name?: string, negate = false): string {
  const condition = type === 'min' ? 'width >=' : 'width <';
  const query = `${negate ? 'not ' : ''}(${condition} ${value})`;
  return name ? `${name} ${query}` : query;
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
  if (bare) return `[data-${bare[1]}]`;
  // #352: bare `aria-<state>` is `[aria-<state>="true"]`
  const aria = /^aria-([a-zA-Z0-9_-]+)$/.exec(variant);
  return aria ? `[aria-${aria[1]}="true"]` : undefined;
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
/**
 * #335: the pseudo-class selector (`:hover`, `:first-child`, `:nth-child(odd)`) of a registered static
 * variant, for compounding in not-/group-/peer-/has- forms, or null when the variant is unknown or is not a
 * single pseudo-class (pseudo-elements, at-rules, multi-selector variants). Tailwind 4.3.3 emits nothing
 * for a compound variant whose inner variant it cannot compound (`not-foo`, `group-before`, `peer-has-foo`).
 */
export function pseudoClassOf(name: string, ctx: Context): string | null {
  const plugin = getModifier(ctx).find((p) => p.name === name && p.match(name, ctx));
  if (!plugin?.modifySelector) return null;
  const r = plugin.modifySelector({ selector: '&', fullClassName: '', mod: { type: name }, context: ctx });
  const list = Array.isArray(r) ? r : r && typeof r === 'object' ? [r] : typeof r === 'string' ? [{ selector: r }] : [];
  if (list.length !== 1) return null;
  const m = /^&(:(?!:)[a-zA-Z-]+(?:\(.*\))?)$/.exec(list[0].selector);
  return m ? m[1] : null;
}

/**
 * #352: the selector `not-<v>` / `group-not-<v>` negates: an attribute variant (`data-*`, `aria-*`), a
 * pseudo-class (#335), or a wrap-free `has-*` variant (`has-[…]`, `has-aria-*`), as Tailwind 4.3.3 compounds
 * them. Null when `<v>` is unknown or is not a single compound on `&`.
 */
export function negatableSelectorOf(name: string, ctx: Context): string | null {
  const attr = attributeVariantSelector(name);
  if (attr) return attr;
  const pc = pseudoClassOf(name, ctx);
  if (pc || !name.startsWith('has-')) return pc;
  const plugin = getModifier(ctx).find((p) => p.match(name, ctx));
  if (!plugin?.modifySelector || plugin.wrap || plugin.astHandler) return null;
  const r = plugin.modifySelector({ selector: '&', fullClassName: '', mod: { type: name }, context: ctx });
  const list = Array.isArray(r) ? r : r && typeof r === 'object' ? [r] : typeof r === 'string' ? [{ selector: r }] : [];
  if (list.length !== 1) return null;
  const m = /^&(:has\(.+\))$/.exec(list[0].selector);
  return m && !m[1].includes('&') ? m[1] : null;
}

/**
 * #352: `not-<v>` for a wrap-only at-rule variant (`md`, `max-md`, `min-[…]`, `print`, `motion-safe`,
 * `supports-[…]`, `dark` in media mode): the same at-rule with its condition negated (`@media not (…)`,
 * `@supports not (…)`), as Tailwind 4.3.3 emits it. Null for anything else, and for a prelude that is a list
 * or already combines conditions, where a leading `not` would not negate the whole query.
 */
export function negatedAtRuleOf(name: string, ctx: Context): AstNode | null {
  if (name.startsWith('not-')) return null;
  const plugin = getModifier(ctx).find((p) => p.match(name, ctx));
  if (!plugin?.wrap || plugin.astHandler) return null;
  if (plugin.modifySelector) {
    const r = plugin.modifySelector({ selector: '&', fullClassName: '', mod: { type: name }, context: ctx });
    const sel = typeof r === 'string' ? r : Array.isArray(r) ? (r.length === 1 ? r[0].selector : null) : r?.selector;
    if (sel !== '&') return null;
  }
  const items = plugin.wrap({ type: name }, ctx);
  if (items.length !== 1) return null;
  const node = items[0];
  if (node.type !== 'at-rule' || (node.name !== 'media' && node.name !== 'supports') || node.nodes?.length) return null;
  const params = (node.params ?? '').trim();
  if (!params || /^not\b|,|\s(and|or)\s/i.test(params)) return null;
  return { ...node, params: `not ${params}`, nodes: [] };
}

/**
 * #354: the at-rule for `not-[@<name> <params>]` (`_` decoded to a space), as Tailwind 4.3.3 emits it:
 * `@media`/`@supports` → `not <params>` (a leading `not` is removed instead), `@container [name] <query>` →
 * `@container [name] not <query>`. Null for any other at-rule, an empty condition or a top-level comma list,
 * where Tailwind emits nothing or an invalid prelude.
 */
export function negatedArbitraryAtRuleOf(value: string): AstNode | null {
  const m = /^@(media|supports|container)(?:\s+|(?=\()|$)([\s\S]*)$/.exec(decodeArbitrarySelector(value).trim());
  if (!m) return null;
  const name = m[1];
  let params = (m[2] ?? '').trim();
  let prefix = '';
  if (name === 'container') {
    const n = /^(?!not\b)([a-zA-Z_-][a-zA-Z0-9_-]*)\s+([\s\S]*)$/.exec(params);
    if (n) { prefix = `${n[1]} `; params = n[2].trim(); }
  }
  if (!params || hasTopLevelComma(params)) return null;
  const neg = /^not\s+/i.test(params) ? params.replace(/^not\s+/i, '') : `not ${params}`;
  if (!neg) return null;
  return atRule(name, `${prefix}${neg}`, [], name);
}
