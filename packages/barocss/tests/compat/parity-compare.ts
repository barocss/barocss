// #245: the effective-value comparator shared by parity-corpus.test.ts and parity-heldout.test.ts.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { compile as compile41 } from 'tailwindcss-4-1';
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

// #274: name → { frame selector → effective declarations }, one entry per frame (`75%, 100%` splits; from/to → 0%/100%).
export function keyframesOf(css: string): Map<string, string> {
  const out = new Map<string, string>();
  postcss.parse(css).walkAtRules(/^(-\w+-)?keyframes$/, (at) => {
    const frames: Record<string, Record<string, string>> = {};
    at.each((node) => {
      if (node.type !== 'rule') return;
      for (const sel of node.selector.split(',')) {
        const key = sel.trim().replace(/^from$/, '0%').replace(/^to$/, '100%');
        const decls = (frames[key] ??= {});
        node.walkDecls((d) => { decls[d.prop] = normalize(d.prop, d.value); });
      }
    });
    const sorted = Object.keys(frames).sort().map((k) => `${k}{${Object.keys(frames[k]).sort().map((p) => `${p}:${frames[k][p]}`).join(';')}}`);
    out.set(at.params.trim(), sorted.join(' '));
  });
  return out;
}

/** #274: every @keyframes Tailwind emits must be defined by BaroCSS with the same effective frames. */
export function diffKeyframes(twCss: string, baroCss: string, out: string[]) {
  const baro = keyframesOf(baroCss);
  for (const [name, frames] of keyframesOf(twCss)) {
    const b = baro.get(name);
    if (b === undefined) out.push(`@keyframes ${name} missing`);
    else if (b !== frames) out.push(`@keyframes ${name}: ${b} ≠ ${frames}`);
  }
}

export type ParityResult = { token: string; uses: number; family: string; varOnly: boolean; pass: boolean; diffs: string[] };

// #304: the primary reference is Tailwind 4.3.x (`tailwindcss`); 4.1.13 (`tailwindcss-4-1`) is kept for a
// report-only comparison line.
export type TwRef = 'tailwindcss' | 'tailwindcss-4-1';
const compilers = { tailwindcss: compile, 'tailwindcss-4-1': compile41 } as const;

export function tailwindBuilder(ref: TwRef = 'tailwindcss') {
  const require = createRequire(import.meta.url);
  const themeCss = fs.readFileSync(require.resolve(`${ref}/theme.css`), 'utf8');
  return async (tokens: string[]) => (await compilers[ref](`${themeCss}\n@tailwind utilities;`)).build(tokens);
}

/** #304: tokens whose *effective* Tailwind output differs between 4.1.13 and 4.3.x. */
export async function tailwindVersionDiffs(tokens: readonly string[]): Promise<string[]> {
  const a = tailwindBuilder('tailwindcss-4-1');
  const b = tailwindBuilder('tailwindcss');
  const key = (e: Effective) => JSON.stringify([e.decls, e.vars, e.wrappers]);
  const out: string[] = [];
  for (const t of tokens) {
    const [ea, eb] = [effective(await a([t]), new Map()), effective(await b([t]), new Map())];
    if (key(ea) === key(eb)) continue;
    const d: string[] = [];
    for (const p of new Set([...Object.keys(ea.decls), ...Object.keys(eb.decls)])) if (ea.decls[p] !== eb.decls[p]) d.push(`${p}: ${ea.decls[p] ?? '∅'} → ${eb.decls[p] ?? '∅'}`);
    for (const p of new Set([...Object.keys(ea.vars), ...Object.keys(eb.vars)])) if (ea.vars[p] !== eb.vars[p]) d.push(`${p}: ${ea.vars[p] ?? '∅'} → ${eb.vars[p] ?? '∅'}`);
    if (ea.wrappers !== eb.wrappers) d.push(`wrapper: ${ea.wrappers || '∅'} → ${eb.wrappers || '∅'}`);
    out.push(`${t}: ${d.join('; ')}`);
  }
  return out;
}

export async function runParity(corpus: readonly (readonly [string, number])[], ref: TwRef = 'tailwindcss'): Promise<ParityResult[]> {
  const ctx = createContext({ preflight: false });
  const baroRoot: Scope = new Map();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) baroRoot.set(d.prop, d.value); });
  const twCss = tailwindBuilder(ref);
  const baroCss = (tokens: string[]) => tokens.map((t) => { try { return generateCss(t, ctx); } catch { return ''; } }).join('\n');

  return Promise.all(corpus.map(async ([token, uses]) => {
    const twText = await twCss([token]);
    const baroText = baroCss([token]);
    const tw = effective(twText, new Map());
    const baro = effective(baroText, baroRoot);
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
    diffKeyframes(twText, baroText, diffs);
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
