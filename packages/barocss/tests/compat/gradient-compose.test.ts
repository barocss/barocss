import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #232: bg-linear / bg-radial / bg-conic with from-/via-/to- stops must resolve to the same background-image as
// Tailwind 4.1.13. Custom properties are applied in source order, var() resolves against :root and @property initial
// values, and a registered property without an initial value is guaranteed-invalid (so the image would be `none`).
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/gradient-compose.test.ts

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
  v.replace(/--baro-/g, '--tw-').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\s*\/\s*/g, '/').trim();

function effectiveBackgroundImage(css: string, base: Scope): string | undefined {
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
  let image: string | undefined;
  root.walkRules((rule) => {
    if (/:root|:host/.test(rule.selector) || !rule.selector.includes('.')) return;
    if (rule.parent?.type === 'atrule') return; // @supports branches; the plain declarations are enough here
    rule.walkDecls((d) => {
      if (d.parent?.type === 'atrule') return;
      if (d.prop.startsWith('--')) scope.set(d.prop, d.value);
      else if (d.prop === 'background-image') image = d.value;
    });
  });
  return image === undefined ? undefined : normalize(resolve(image, scope));
}

const combos = [
  'bg-radial from-red-500 to-blue-500',
  'bg-conic from-red-500 to-blue-500',
  'bg-radial from-red-500 via-green-500 to-blue-500',
  'bg-conic-180 from-red-500 to-blue-500',
  'bg-radial-[at_25%_25%] from-red-500 to-blue-500',
  'bg-linear-to-r from-red-500 via-green-500 to-blue-500',
  'bg-gradient-to-r from-red-500 from-10% to-blue-500 to-90%',
];

describe('gradient utilities + stops compose like Tailwind 4.1.13 (#232)', async () => {
  const require = createRequire(import.meta.url);
  const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const ctx = createContext({ preflight: false });
  const baroRoot: Scope = new Map();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) baroRoot.set(d.prop, d.value); });

  it.each(combos)('%s', async (classes) => {
    // build() accumulates candidates across calls, so each combo gets its own compiler.
    const tw = await compile(`${themeCss}\n@tailwind utilities;`);
    const expected = effectiveBackgroundImage(tw.build(classes.split(' ')), new Map());
    const actual = effectiveBackgroundImage(generateCss(classes, ctx), baroRoot);
    expect(expected).toBeDefined();
    expect(expected).not.toContain(INVALID);
    expect(actual).toBe(expected);
  });
});
