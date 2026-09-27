// #430: UnoCSS @unocss/core + presetWind4 vs Tailwind 4.3.x over the kit parity corpora (corpus.ts = tuned,
// corpus-heldout.ts = held-out), with the kit's effective-value comparator (tests/compat/parity-compare.ts):
// same effective(), partnerOf(), diffKeyframes(), invalidSelectors(), coverageReport(); the diff() below is a copy of
// the (unexported) one there. The Uno side is judged by its own output only (its :root/:host theme vars and @property
// initial values feed the scope, like BaroCSS's themeToCssVars()).
// Rerun (repo root; node_modules from a pnpm install; @unocss/* in scripts/unocss-430/.scratch, see NOTES.md):
//   node node_modules/vitest/vitest.mjs run --root scripts/unocss-430 corpus-parity.test.ts
import fs from 'node:fs';
import { it } from 'vitest';
import path from 'node:path';
import { corpus } from '../../packages/barocss/tests/compat/corpus';
import { corpusHeldout } from '../../packages/barocss/tests/compat/corpus-heldout';
import { coverageReport, diffKeyframes, effective, familyOf, INVALID, invalidSelectors, partnerOf, runParity, tailwindBuilder, type ParityResult } from '../../packages/barocss/tests/compat/parity-compare';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const S = path.join(HERE, '.scratch/node_modules/@unocss');
const { createGenerator } = await import(path.join(S, 'core/dist/index.mjs'));
const { presetWind4 } = await import(path.join(S, 'preset-wind4/dist/index.mjs'));
const versions = Object.fromEntries(['core', 'preset-wind4'].map((p) => [p, JSON.parse(fs.readFileSync(path.join(S, p, 'package.json'), 'utf8')).version]));
// Tailwind-4-like defaults: presetWind4() as documented; reset preflight off because the comparator judges utilities only.
const uno = await createGenerator({ presets: [presetWind4({ preflights: { reset: false } })] });
const unoCss = async (tokens: string[]) => (await uno.generate(new Set(tokens), { preflights: true })).css;

type Eff = ReturnType<typeof effective>;
function diff(tw: Eff, other: Eff, out: string[], tag = '') {
  for (const [prop, value] of Object.entries(tw.decls)) {
    const b = other.decls[prop];
    if (b === undefined) out.push(`${tag}${prop} missing`);
    else if (b.includes(INVALID) && !value.includes(INVALID)) out.push(`${tag}${prop} undefined var`);
    else if (b !== value) out.push(`${tag}${prop}: ${b} ≠ ${value}`);
  }
  if (other.wrappers !== tw.wrappers) out.push(`${tag}wrapper: ${other.wrappers || '∅'} ≠ ${tw.wrappers || '∅'}`);
}
const tw = tailwindBuilder('tailwindcss');
// Lenient pass (reported separately, strict is the headline): spellings that render the same on a page.
// color-mix(in x, C 100%, transparent) = C; flex 1 1 0% = 1; transparent shadow spellings; line-height Nrem = N/font-size
// ratio; border-*-style missing counts as equal because presetWind4's default reset sets border-style: solid on *.
const num = (v: string) => { const m = v.match(/^calc\((-?[\d.]+)\/([\d.]+)\)$/); return m ? +m[1] / +m[2] : NaN; };
function lenient(e: Eff): Eff {
  const d: Record<string, string> = {};
  for (const [k, v0] of Object.entries(e.decls)) {
    let v = v0;
    for (let p = ''; p !== v;) { p = v; v = v.replace(/color-mix\(in \w+,((?:[^()]|\([^()]*\))+) 100%,transparent\)/g, '$1'); }
    v = v.replace(/^1 1 0%$/, '1').replace(/rgb\(0 0 0\/0\)/g, '#0000');
    d[k] = v;
  }
  const fs0 = d['font-size'], lh = d['line-height'];
  if (fs0 && lh && /rem$/.test(lh) && /rem$/.test(fs0)) d['line-height'] = (parseFloat(lh) / parseFloat(fs0)).toFixed(4);
  else if (lh && !Number.isNaN(num(lh))) d['line-height'] = num(lh).toFixed(4);
  return { ...e, decls: d };
}
async function runUno(c: readonly (readonly [string, number])[]): Promise<ParityResult[]> {
  const out: ParityResult[] = [];
  for (const [token, uses] of c) {
    const twText = await tw([token]), uText = await unoCss([token]);
    const t = effective(twText, new Map()), u = effective(uText, new Map());
    const varOnly = !Object.keys(t.decls).length && Object.keys(t.vars).length > 0;
    const diffs: string[] = [];
    if (!varOnly) { if (!Object.keys(u.decls).length) diffs.push('no rule'); else diff(t, u, diffs); }
    const lz: string[] = [];
    if (!varOnly && Object.keys(u.decls).length) { diff(lenient(t), lenient(u), lz); }
    else {
      const partner = partnerOf(token);
      if (partner) diff(effective(await tw([partner, token]), new Map(), true), effective(await unoCss([partner, token]), new Map(), true), diffs, `[+${partner}] `);
      else {
        if (!Object.keys(u.vars).length && !Object.keys(u.decls).length) diffs.push('no rule');
        for (const [n, v] of Object.entries(t.vars)) if (u.vars[n] === undefined) diffs.push(`${n} not set`); else if (u.vars[n] !== v) diffs.push(`${n}: ${u.vars[n]} ≠ ${v}`);
      }
    }
    diffKeyframes(twText, uText, diffs);
    diffs.push(...invalidSelectors(uText));
    const lzPass = diffs.length === 0 || (!varOnly && lz.filter((x) => !/border(-\w+)?-style missing/.test(x)).length === 0 && !invalidSelectors(uText).length);
    out.push({ token, uses, family: familyOf(token), varOnly, pass: diffs.length === 0, diffs, lenientPass: lzPass } as ParityResult);
  }
  return out;
}
const res: Record<string, unknown> = { versions, tailwind: JSON.parse(fs.readFileSync(path.join(HERE, '../../node_modules/tailwindcss/package.json'), 'utf8')).version };
for (const [name, c] of [['tuned', corpus], ['heldout', corpusHeldout]] as const) {
  const u = await runUno(c), b = await runParity(c);
  const rate = (r: ParityResult[]) => ({ classes: `${r.filter((x) => x.pass).length}/${r.length}`, usesPct: +(100 * r.filter((x) => x.pass).reduce((n, x) => n + x.uses, 0) / r.reduce((n, x) => n + x.uses, 0)).toFixed(1) });
  const noRule = u.filter((x) => x.diffs.includes('no rule')).length;
  const lzr = u.map((x) => ({ ...x, pass: (x as ParityResult & { lenientPass: boolean }).lenientPass }));
  res[name] = { uno: { ...rate(u), noRule }, unoLenient: rate(lzr), unoLenientFailSample: lzr.filter((x) => !x.pass).slice(0, 40).map((x) => `${x.token}: ${x.diffs.slice(0, 1).join('; ')}`), baro: rate(b), unoFailSample: u.filter((x) => !x.pass).slice(0, 25).map((x) => `${x.token}: ${x.diffs.slice(0, 2).join('; ')}`) };
  console.log(coverageReport(`${name} uno`, u).split('\n').slice(0, 6).join('\n'));
  console.log(coverageReport(`${name} uno lenient`, lzr).split('\n')[0]);
  console.log(coverageReport(`${name} baro`, b).split('\n')[0]);
}
fs.writeFileSync(path.join(HERE, 'corpus-result.json'), JSON.stringify(res, null, 1));
it('wrote corpus-result.json', () => {});
