// #245: the effective-value comparator shared by parity-corpus.test.ts and parity-heldout.test.ts.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import postcss, { type AtRule, type Container, type Declaration, type Rule } from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

export const INVALID = '⟂';
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

export const families: [string, RegExp][] = [
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
export const familyOf = (token: string) => families.find(([, re]) => re.test(token))?.[0] ?? 'other';


// { prop → value } for the utility's rules, plus the @media/@container conditions they sit under.
// `vars` holds the custom properties the class rules set (names normalised --baro-* → --tw-*, values resolved),
// so a class that only sets variables (ring-blue-500, from-sky-500, ring-inset) still has something to compare.
// With `element`, all class rules apply to one element (a composite like `ring-2 ring-blue-500`): every rule's
// custom properties feed one shared scope before any declaration is resolved.
export function effective(css: string, base: Scope, element = false) {
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
  // Only rules that target a class; BaroCSS's legacy gradients emit a bare `&` selector that matches nothing.
  const classRules: Rule[] = [];
  root.walkRules((rule) => {
    if (/:root|:host/.test(rule.selector) || rule.parent?.type === 'rule' || !rule.selector.includes('.')) return;
    classRules.push(rule);
  });
  const shared: Scope = new Map(scope);
  if (element) for (const rule of classRules) rule.walkDecls((d) => { if (d.prop.startsWith('--')) shared.set(d.prop, d.value); });
  const decls: Record<string, string> = {};
  const vars: Record<string, string> = {};
  const wrappers = new Set<string>();
  for (const rule of classRules) {
    const local: Scope = new Map(element ? shared : scope);
    if (!element) rule.walkDecls((d) => { if (d.prop.startsWith('--')) local.set(d.prop, d.value); });
    rule.walkDecls((d: Declaration) => {
      if (d.prop.startsWith('--')) {
        vars[d.prop.replace(/^--baro-/, '--tw-')] = normalize(d.prop, resolve(d.value, local));
        return;
      }
      decls[d.prop] = normalize(d.prop, resolve(d.value, local));
      for (let p: Container | undefined = d.parent as Container; p && p.type !== 'root'; p = p.parent as Container) {
        if (p.type === 'atrule' && ['media', 'container'].includes((p as AtRule).name)) wrappers.add(mediaKey(p as AtRule));
      }
    });
  }
  return { decls, vars, wrappers: [...wrappers].sort().join(' | ') };
}
type Effective = ReturnType<typeof effective>;

// A var-only class has no visible effect alone; its Tailwind composition partner gives it one. The partner keeps
// the token's variant prefix (focus:ring-blue-500 → focus:ring-2).
export function partnerOf(token: string): string | undefined {
  const cut = token.lastIndexOf(':');
  const prefix = cut < 0 ? '' : token.slice(0, cut + 1);
  const base = cut < 0 ? token : token.slice(cut + 1);
  if (/^inset-ring-/.test(base)) return `${prefix}inset-ring-2`;
  if (/^ring-/.test(base)) return `${prefix}ring-2`;
  if (/^(from|via|to)-/.test(base)) return `${prefix}bg-linear-to-r`;
  if (/^inset-shadow-/.test(base)) return `${prefix}inset-shadow-sm`;
  if (/^shadow-/.test(base)) return `${prefix}shadow-md`;
  return undefined;
}

function diff(tw: Effective, baro: Effective, out: string[], tag = '') {
  for (const [prop, value] of Object.entries(tw.decls)) {
    const b = baro.decls[prop];
    if (b === undefined) out.push(`${tag}${prop} missing`);
    else if (b.includes(INVALID) && !value.includes(INVALID)) out.push(`${tag}${prop} undefined var`);
    else if (b !== value) out.push(`${tag}${prop}: ${b} ≠ ${value}`);
  }
  if (baro.wrappers !== tw.wrappers) out.push(`${tag}wrapper: ${baro.wrappers || '∅'} ≠ ${tw.wrappers || '∅'}`);
}

export type ParityResult = { token: string; uses: number; family: string; varOnly: boolean; pass: boolean; diffs: string[] };

export async function runParity(corpus: readonly (readonly [string, number])[]): Promise<ParityResult[]> {
  const require = createRequire(import.meta.url);
  const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const ctx = createContext({ preflight: false });
  const baroRoot: Scope = new Map();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) baroRoot.set(d.prop, d.value); });
  const twCss = async (tokens: string[]) => (await compile(`${themeCss}\n@tailwind utilities;`)).build(tokens);
  const baroCss = (tokens: string[]) => tokens.map((t) => { try { return generateCss(t, ctx); } catch { return ''; } }).join('\n');

  return Promise.all(corpus.map(async ([token, uses]) => {
    const tw = effective(await twCss([token]), new Map());
    const baro = effective(baroCss([token]), baroRoot);
    // Var-only: Tailwind's rule sets custom properties and nothing else (ring colours, ring-inset, from-*, …).
    const varOnly = !Object.keys(tw.decls).length && Object.keys(tw.vars).length > 0;
    const diffs: string[] = [];
    if (!varOnly) {
      if (!Object.keys(baro.decls).length) diffs.push('no rule');
      else diff(tw, baro, diffs);
    } else {
      const partner = partnerOf(token);
      if (partner) {
        // Judged by the effective value next to the partner (e.g. ring-2 + ring-blue-500 → box-shadow).
        const twC = effective(await twCss([partner, token]), new Map(), true);
        const baroC = effective(baroCss([partner, token]), baroRoot, true);
        diff(twC, baroC, diffs, `[+${partner}] `);
      } else {
        // No known partner: judged by the variables themselves (--baro-* ≡ --tw-*, resolved values).
        if (!Object.keys(baro.vars).length && !Object.keys(baro.decls).length) diffs.push('no rule');
        for (const [name, value] of Object.entries(tw.vars)) {
          const b = baro.vars[name];
          if (b === undefined) diffs.push(`${name} not set`);
          else if (b !== value) diffs.push(`${name}: ${b} ≠ ${value}`);
        }
      }
    }
    return { token, uses, family: familyOf(token), varOnly, pass: diffs.length === 0, diffs };
  }));
}

export function coverageReport(label: string, results: ParityResult[]): string {
  const total = results.reduce((n, r) => n + r.uses, 0);
  const passing = results.filter((r) => r.pass).reduce((n, r) => n + r.uses, 0);
  const byFamily = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const f = byFamily.get(r.family) ?? { pass: 0, fail: 0 };
    f[r.pass ? 'pass' : 'fail'] += r.uses;
    byFamily.set(r.family, f);
  }
  const vo = results.filter((r) => r.varOnly);
  return [
    `${label}: ${((passing / total) * 100).toFixed(1)}% of ${total} corpus uses (${results.filter((r) => r.pass).length}/${results.length} classes; var-only ${vo.filter((r) => r.pass).length}/${vo.length})`,
    ...[...byFamily].sort((a, b) => b[1].fail - a[1].fail).map(([f, { pass, fail }]) => `  ${f.padEnd(15)} ${pass}/${pass + fail} uses at parity`),
  ].join('\n');
}
