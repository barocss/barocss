import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #205: shadow-* and ring-* on one element must compose into one box-shadow, as in Tailwind 4.1.13.
// Effective value of the element's box-shadow: every class rule's custom properties are applied in source order
// (as the cascade would for equal-specificity rules), var() is resolved against :root and @property initial values.
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/shadow-ring-compose.test.ts

const INVALID = '⟂';
type Scope = Map<string, string>;

function resolve(value: string, scope: Scope, depth = 0): string {
  if (depth > 20) return INVALID;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf('var(', i);
    if (start < 0) { out += value.slice(i); break; }
    out += value.slice(i, start);
    let end = start + 4;
    for (let open = 1; end < value.length && open; end++) {
      if (value[end] === '(') open++;
      else if (value[end] === ')') open--;
    }
    const inner = value.slice(start + 4, end - 1);
    const comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const own = scope.get(name);
    const next = own !== undefined && own !== INVALID ? own : comma < 0 ? INVALID : inner.slice(comma + 1);
    const resolved = next === INVALID ? INVALID : resolve(next, scope, depth + 1);
    if (resolved.includes(INVALID)) return INVALID;
    out += resolved;
    i = end;
  }
  return out;
}

const normalize = (v: string) =>
  v.replace(/--baro-/g, '--tw-').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\s*\/\s*/g, '/')
    .replace(/(^|[^\d.])0\./g, '$1.').replace(/\bcurrentColor\b/g, 'currentcolor').trim();

function effectiveBoxShadow(css: string, base: Scope): string | undefined {
  const root = postcss.parse(css);
  const scope: Scope = new Map(base);
  root.walkAtRules('property', (at) => {
    let initial = INVALID;
    at.walkDecls('initial-value', (d) => { initial = d.value; });
    if (!scope.has(at.params)) scope.set(at.params, initial);
  });
  root.walkRules((r) => {
    if (/:root|:host/.test(r.selector)) r.walkDecls((d) => { if (d.prop.startsWith('--')) scope.set(d.prop, d.value); });
  });
  let boxShadow: string | undefined;
  root.walkRules((rule) => {
    if (/:root|:host/.test(rule.selector) || !rule.selector.includes('.')) return;
    rule.walkDecls((d) => {
      if (d.parent?.type === 'atrule') return; // @supports branches; the plain declaration is enough here
      if (d.prop.startsWith('--')) scope.set(d.prop, d.value);
      else if (d.prop === 'box-shadow') boxShadow = d.value;
    });
  });
  return boxShadow === undefined ? undefined : normalize(resolve(boxShadow, scope));
}

const combos = ['shadow-sm ring-1', 'shadow-md ring-2 ring-offset-2', 'shadow ring', 'ring-1 shadow-sm', 'shadow-none ring-2',
  // #225: arbitrary ring width, ring offset in either class order, inset shadow scale, inset ring defaults.
  'ring-[3px]', 'focus-visible:ring-[3px]', 'ring-[#ff0000] ring-2', 'ring-2 ring-offset-2', 'ring-offset-2 ring-2',
  'inset-shadow-2xs', 'inset-shadow-xs', 'inset-shadow-sm', 'inset-ring-2', 'inset-ring-2 ring-2'];

describe('shadow-* + ring-* compose like Tailwind 4.1.13 (#205)', async () => {
  const require = createRequire(import.meta.url);
  const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const ctx = createContext({ preflight: false });
  const baroRoot: Scope = new Map();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) baroRoot.set(d.prop, d.value); });

  it.each(combos)('%s', async (classes) => {
    // build() accumulates candidates across calls, so each combo gets its own compiler.
    const tw = await compile(`${themeCss}\n@tailwind utilities;`);
    const expected = effectiveBoxShadow(tw.build(classes.split(' ')), new Map());
    const actual = effectiveBoxShadow(generateCss(classes, ctx), baroRoot);
    expect(expected).toBeDefined();
    expect(actual).not.toContain(INVALID);
    expect(actual).toBe(expected);
  });
});
