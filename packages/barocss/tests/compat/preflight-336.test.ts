import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { preflightFullCSS, preflightStandardCSS, preflightMinimalCSS } from '../../src/css/preflight';

// #336: BaroCSS preflight vs Tailwind 4.3.3's compiled preflight, rule by rule:
// "<at-rule context> <selector>" -> effective declarations (later declarations win).

const require = createRequire(import.meta.url);

/** `var(--default-*, X)` / `var(--font-*, X)` -> X (TW compiles --theme() to its fallback without a theme). */
function normValue(v: string): string {
  let out = v.replace(/\s+/g, ' ').replace(/"/g, "'").trim();
  let prev;
  do {
    prev = out;
    out = out.replace(/^var\(--(?:default-[\w-]+|font-[\w-]+),\s*([\s\S]*)\)$/, '$1').trim();
  } while (out !== prev);
  return out;
}

const normSel = (s: string) => s.replace(/\s+/g, ' ').replace(/"/g, "'").replace(/\s*([,>+~()])\s*/g, '$1').trim();

function splitTop(sel: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(normSel).filter(Boolean);
}

type RuleMap = Map<string, Map<string, string>>;

function ruleMap(css: string): RuleMap {
  const map: RuleMap = new Map();
  postcss.parse(css).walkRules((rule) => {
    const ctx: string[] = [];
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
      const a = p as postcss.AtRule;
      if (a.name !== 'layer') ctx.unshift(`@${a.name} ${a.params.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()}`);
    }
    for (const sel of splitTop(rule.selector)) {
      const key = [...ctx, sel].join(' ');
      const decls = map.get(key) ?? new Map<string, string>();
      rule.walkDecls((d) => { decls.set(d.prop, normValue(d.value) + (d.important ? ' !important' : '')); });
      map.set(key, decls);
    }
  });
  return map;
}

/** Every difference as a line: "- sel" (missing), "+ sel" (extra), "~ sel { prop: ours | tw }". */
function diff(ours: RuleMap, tw: RuleMap): string[] {
  const out: string[] = [];
  for (const [sel, twDecls] of tw) {
    const o = ours.get(sel);
    if (!o) { out.push(`- ${sel}`); continue; }
    for (const [prop, val] of twDecls) if (o.get(prop) !== val) out.push(`~ ${sel} { ${prop}: ${o.get(prop) ?? '(unset)'} | ${val} }`);
    for (const [prop, val] of o) if (!twDecls.has(prop)) out.push(`~ ${sel} { ${prop}: ${val} | (unset) }`);
  }
  for (const sel of ours.keys()) if (!tw.has(sel)) out.push(`+ ${sel}`);
  return out;
}

async function tailwindPreflight(): Promise<string> {
  const src = readFileSync(require.resolve('tailwindcss/preflight.css'), 'utf8');
  return (await compile(`@layer base {\n${src}\n}`)).build([]);
}

// Deliberate differences of the lighter levels. They are smaller, normalize-style resets by design (#228), so
// only `full` is a Tailwind port. Each group: a reason and the diff-line prefixes it explains.
type Known = Array<[reason: string, prefixes: string[]]>;
const SHARED: Known = [
  ["legacy `*, *::before, *::after` selector instead of TW's `*, ::after, ::before, ::backdrop, ::file-selector-button`; the universal `border: 0 solid` is in `full` only",
    ['~ * { border:', '- ::after', '- ::before', '- ::backdrop', '+ *::before', '+ *::after']],
  ['page-level body reset, `picture` block and prefers-reduced-motion rules: BaroCSS extras, not in TW',
    ['+ body', '+ picture', '+ @media (prefers-reduced-motion: reduce)']],
  ['img keeps its intrinsic height and baseline alignment (lighter levels only constrain width)', ['~ img { vertical-align:', '~ img { height:']],
  ['no heading/hr/abbr/small/menu/summary resets: typography stays browser-default in lighter levels',
    ['- hr', '- abbr', '- h1', '- h2', '- h3', '- h4', '- h5', '- h6', '- small', '- summary', '- menu']],
  ['only img/picture get the replaced-element reset; video/canvas/audio/embed/object keep browser display',
    ['- video', '- canvas', '- audio', '- embed', '- object']],
  ['no vendor pseudo-element fixes (date/time, search, spin buttons, Firefox focus/invalid) and no `:host` / `[hidden]` rules',
    ['- ::-webkit', '- :-moz-', '- input:where(', '- [hidden]', '- :host']],
];
const KNOWN: Record<'standard' | 'minimal', Known> = {
  standard: [
    ...SHARED,
    ['::file-selector-button gets only the form-control reset, not the box reset / appearance', ['~ ::file-selector-button']],
    ['html keeps normalize.css line-height 1.15 and no tab-size / tap highlight', ['~ html {']],
    ['links: normalize.css `background-color: transparent; text-decoration: none` instead of `inherit`', ['~ a {']],
    ['table: normalize.css `border-spacing: 0`, no text-indent / border-color inherit', ['~ table {']],
    ['svg only gets vertical-align; iframe keeps `border: 0` and inline display', ['~ svg {', '~ iframe {']],
    ['normalize.css form-control rules (font-size 100%, line-height 1.15, margin 0, -webkit-appearance, fieldset, legend, [type=…] fixes) kept under the TW reset',
      ['~ button {', '~ input {', '~ select {', '~ optgroup {', '~ textarea {', '+ [type=', '+ button::-moz', '+ button:-moz', '+ fieldset', '+ legend']],
  ],
  minimal: [
    ...SHARED,
    ['box-sizing/margin only: no html typography, inline element, table, svg/iframe or file-button rules',
      ['- ::file-selector-button', '- html', '- a', '- b', '- strong', '- code', '- kbd', '- samp', '- pre', '- sub', '- sup', '- table', '- progress', '- svg', '- iframe', '- optgroup', '- :where(select']],
    ['form controls only inherit `font`; no colour/radius/background/placeholder/resize resets', ['~ button {', '~ input {', '~ select {', '~ textarea {', '- ::placeholder', '- @supports']],
  ],
};

describe('#336 preflight vs Tailwind 4.3.3', () => {
  it('reads Tailwind 4.3.3', () => {
    expect(require('tailwindcss/package.json').version).toBe('4.3.3');
  });

  it('full: no difference', async () => {
    expect(diff(ruleMap(preflightFullCSS), ruleMap(await tailwindPreflight()))).toEqual([]);
  });

  it.each([['standard', preflightStandardCSS], ['minimal', preflightMinimalCSS]] as const)('%s: only KNOWN differences', async (level, css) => {
    const lines = diff(ruleMap(css), ruleMap(await tailwindPreflight()));
    const prefixes = KNOWN[level].flatMap(([, ps]) => ps);
    const unexplained = lines.filter((l) => !prefixes.some((p) => l.startsWith(p)));
    expect(unexplained).toEqual([]);
    // Every KNOWN prefix still matches something, so the list cannot go stale.
    for (const p of prefixes) expect(lines.some((l) => l.startsWith(p)), p).toBe(true);
  });
});
