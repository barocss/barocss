import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import postcss, { type AtRule, type Container, type Declaration } from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { corpus } from './corpus';

// Parity of every #179 corpus class with Tailwind 4.1.13 (full default theme), compared by *effective* value:
// var() resolved against each side's :root, @property initial values and the rule's own custom properties, so
// equivalent output written differently (BaroCSS --baro-* vars vs Tailwind --tw-* vars) counts as parity.
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/parity-corpus.test.ts
//
// prints the frequency-weighted coverage. KNOWN_FAILURES lists classes that don't match yet; remove an entry when
// its fix lands (the test fails if a listed class starts passing, so the list can't go stale).

const KNOWN_FAILURES: Record<string, string> = {
  "focus:outline-none": "outline v4 semantics (#187)",
  "space-y-3": "equivalent: margin on following siblings (v3 selector)",
  "bg-gradient-to-br": "legacy gradient emits a bare & selector (#187)",
  "focus-visible:ring-[3px]": "arbitrary ring width emits box-shadow: 3px (#187)",
  "outline-none": "outline v4 semantics (#187)",
  "outline-hidden": "outline v4 semantics (#187)",
  "rounded-sm": "radius scale on v3 values",
  "select-none": "no -webkit-user-select",
  "sr-only": "clip instead of clip-path",
  "blur-3xl": "blur scale on v3 values",
  "bg-gradient-to-r": "legacy gradient emits a bare & selector (#187)",
  "@container/card-header": "no container-type utility (#187)",
  "after:absolute": "content missing",
  "after:opacity-0": "content missing",
  "after:transition-opacity": "::after/::before get no content (#187)",
  "focus-visible:outline-1": "outline v4 semantics (#187)",
  "focus:outline-hidden": "outline v4 semantics (#187)",
  "group-data-[orientation=horizontal]/tabs:after:bottom-[-5px]": "content missing",
  "group-data-[orientation=horizontal]/tabs:after:h-0.5": "content missing",
  "group-data-[orientation=horizontal]/tabs:after:inset-x-0": "content missing",
  "group-data-[orientation=vertical]/tabs:after:-right-1": "content missing",
  "group-data-[orientation=vertical]/tabs:after:inset-y-0": "content missing",
  "group-data-[orientation=vertical]/tabs:after:w-0.5": "content missing",
  "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100": "content missing",
  "h-[calc(100%-1px)]": "arbitrary calc() without operator spaces (#187)",
  "has-data-[slot=card-action]:grid-cols-[1fr_auto]": "has-* variant missing",
  "justify-self-end": "justify-self-end emits end, TW flex-end",
  "max-w-[calc(100%-2rem)]": "arbitrary calc() without operator spaces (#187)",
  "rounded-xs": "radius scale on v3 values",
};

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

// Spelling-only differences that render the same.
function normalize(prop: string, value: string): string {
  let v = value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s*,\s*/g, ',').replace(/\s*\/\s*/g, '/');
  // BaroCSS namespaces its internal vars --baro-*, Tailwind --tw-*; as values (e.g. in transition-property) they're the same.
  v = v.replace(/--baro-/g, '--tw-').replace(/calc\(infinity \* 1px\)/g, '9999px').replace(/\bcurrentColor\b/g, 'currentcolor').replace(/in lab\b/g, 'in oklab');
  for (let prev = ''; prev !== v;) {
    prev = v;
    v = v.replace(/calc\((-?[\d.]+)\/([\d.]+) \* 100%\)/g, (_, a, b) => `${+((a / b) * 100).toFixed(4)}%`)
      .replace(/calc\((-?[\d.]+)(rem|px|em|%)? ?\* ?(-?[\d.]+)\)/g, (_, a, u = '', b) => `${+(a * b).toFixed(4)}${u}`)
      .replace(/calc\((-?[\d.]+(?:rem|px|em|%))\)/g, '$1');
  }
  v = v.replace(/(^|[^\d.])0\./g, '$1.').replace(/(^|[\s(,])-?0(px|rem|em)\b/g, '$10').trim();
  if (prop === 'opacity' && v.endsWith('%')) v = String(parseFloat(v) / 100).replace(/^0\./, '.');
  if (prop === 'box-shadow') v = v.replace(/(0 0 #0000,)+/g, '').replace(/,0 0 #0000$/, '');
  return v;
}

function mediaKey(at: AtRule): string {
  const params = at.params.replace(/\(width >= ([^)]+)\)/g, '(min-width: $1)').replace(/\s+/g, ' ').trim();
  return `@${at.name} ${params}`;
}

// { prop → value } for the utility's rules, plus the @media/@container conditions they sit under.
function effective(css: string, base: Scope) {
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
  const decls: Record<string, string> = {};
  const wrappers = new Set<string>();
  root.walkRules((rule) => {
    // Only rules that target a class; BaroCSS's legacy gradients emit a bare `&` selector that matches nothing.
    if (/:root|:host/.test(rule.selector) || rule.parent?.type === 'rule' || !rule.selector.includes('.')) return;
    const local: Scope = new Map(scope);
    rule.walkDecls((d) => { if (d.prop.startsWith('--')) local.set(d.prop, d.value); });
    rule.walkDecls((d: Declaration) => {
      if (d.prop.startsWith('--')) return;
      decls[d.prop] = normalize(d.prop, resolve(d.value, local));
      for (let p: Container | undefined = d.parent as Container; p && p.type !== 'root'; p = p.parent as Container) {
        if (p.type === 'atrule' && ['media', 'container'].includes((p as AtRule).name)) wrappers.add(mediaKey(p as AtRule));
      }
    });
  });
  return { decls, wrappers: [...wrappers].sort().join(' | ') };
}

const families: [string, RegExp][] = [
  ['pseudo content', /(^|:)(after|before):/],
  ['arbitrary calc', /\[calc\(/],
  ['ring', /^(focus(-visible)?:)?(inset-)?ring/],
  ['leading', /^leading-/],
  ['shadow', /(^|:)(inset-)?shadow/],
  ['translate', /(^|:)-?translate-/],
  ['border', /(^|:)border(-[trblxy])?(-\d+)?$/],
  ['gradient', /(^|:)(bg-gradient-|from-|via-|to-)/],
  ['outline', /(^|:)outline/],
  ['radius', /(^|:)rounded/],
  ['blur', /(^|:)blur/],
  ['transition', /(^|:)transition/],
];
const familyOf = (token: string) => families.find(([, re]) => re.test(token))?.[0] ?? 'other';

describe('Tailwind 4.1.13 parity over the #179 corpus', async () => {
  const require = createRequire(import.meta.url);
  const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const ctx = createContext({ preflight: false });
  const baroRoot: Scope = new Map();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) baroRoot.set(d.prop, d.value); });

  const results = await Promise.all(corpus.map(async ([token, uses]) => {
    const tw = effective((await compile(`${themeCss}\n@tailwind utilities;`)).build([token]), new Map());
    let baroCss = '';
    try { baroCss = generateCss(token, ctx); } catch { /* counts as no rule */ }
    const baro = effective(baroCss, baroRoot);
    const diffs: string[] = [];
    if (!Object.keys(baro.decls).length) diffs.push('no rule');
    else {
      for (const [prop, value] of Object.entries(tw.decls)) {
        const b = baro.decls[prop];
        if (b === undefined) diffs.push(`${prop} missing`);
        else if (b.includes(INVALID) && !value.includes(INVALID)) diffs.push(`${prop} undefined var`);
        else if (b !== value) diffs.push(`${prop}: ${b} ≠ ${value}`);
      }
      if (baro.wrappers !== tw.wrappers) diffs.push(`wrapper: ${baro.wrappers || '∅'} ≠ ${tw.wrappers || '∅'}`);
    }
    return { token, uses, family: familyOf(token), pass: diffs.length === 0, diffs };
  }));

  const total = results.reduce((n, r) => n + r.uses, 0);
  const passing = results.filter((r) => r.pass).reduce((n, r) => n + r.uses, 0);
  const byFamily = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const f = byFamily.get(r.family) ?? { pass: 0, fail: 0 };
    f[r.pass ? 'pass' : 'fail'] += r.uses;
    byFamily.set(r.family, f);
  }
  console.log([
    `parity coverage: ${((passing / total) * 100).toFixed(1)}% of ${total} corpus uses (${results.filter((r) => r.pass).length}/${results.length} classes)`,
    ...[...byFamily].sort((a, b) => b[1].fail - a[1].fail).map(([f, { pass, fail }]) => `  ${f.padEnd(15)} ${pass}/${pass + fail} uses at parity`),
  ].join('\n'));

  it('every class outside KNOWN_FAILURES matches Tailwind', () => {
    const unexpected = results.filter((r) => !r.pass && !(r.token in KNOWN_FAILURES));
    expect(unexpected.map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('every KNOWN_FAILURES entry still fails (remove it once fixed)', () => {
    const fixed = results.filter((r) => r.pass && r.token in KNOWN_FAILURES).map((r) => r.token);
    expect(fixed).toEqual([]);
  });

  it('fixed families stay fixed: ring composition, leading-*, bare shadow', () => {
    const guarded = results.filter((r) => ['ring-1', 'ring-2', 'shadow'].includes(r.token) || r.family === 'leading');
    expect(guarded.length).toBeGreaterThan(3);
    expect(guarded.filter((r) => !r.pass).map((r) => r.token)).toEqual([]);
  });
});
