// #385 baseline: Tailwind 4 with the site's theme after an @theme reset (--color-*: initial; shadcn also --radius-*),
// plus a no-arbitrary-values lint (regex /\[/ on each class). Compared per class use with the classifier's labels.
// Rerun (repo root): node scripts/o7-enforce/baseline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SITES, classify, loadDatasets } from './classify.mjs';
import { SITE_THEME_CSS } from '../cms-probe/site.mjs';
import { THEME_CSS } from '../cms-probe/theme-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const twTheme = fs.readFileSync(path.join(twDir, 'theme.css'), 'utf8');
const keep = twTheme.split('\n').filter((l) => /--color-(slate-\d+|white|black):/.test(l)).join('\n'); // families the shell uses
const APP = fs.readFileSync(path.join(ROOT, 'scripts/json-render-probe/e2e/app.css'), 'utf8').replace(/@layer base[\s\S]*$/, '');
export const SITE_TW = {
  shadcn: APP + '\n@theme { --color-white: #fff; --color-black: #000; }',
  cms253: SITE_THEME_CSS + `\n@theme {\n${keep}\n}`,
  theme255: THEME_CSS('') + `\n@theme {\n${keep}\n}`,
};
const load = async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
  const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
};
const compilers = {};
export async function tw(site, reset) {
  const k = site + reset;
  if (!compilers[k]) {
    const c = await compile(`@import "tailwindcss";\n${reset ? SITES[site].reset : ''}\n${SITE_TW[site]}`, { base: twDir, loadStylesheet: load });
    compilers[k] = { c, empty: c.build([]).length, cache: new Map() };
  }
  return compilers[k];
}
export async function resolves(site, reset, cls) {
  const x = await tw(site, reset);
  if (!x.cache.has(cls)) { const n = x.c.build([cls]).length; x.cache.set(cls, n > x.empty); x.empty = n; } // build() accumulates: compare with the previous length
  return x.cache.get(cls);
}
// Baseline feedback for one class: what reset build + lint can say.
export async function baselineFlag(site, cls) {
  const lint = /\[/.test(cls);
  const normal = await resolves(site, false, cls);
  const reset = await resolves(site, true, cls);
  return { lint, droppedByReset: normal && !reset, unknown: !normal, flagged: lint || (normal && !reset) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = loadDatasets();
  const m = {}; const misses = {}; const fps = {};
  for (const it of items) for (const c of it.classes) {
    const r = classify(c, it.site);
    const b = await baselineFlag(it.site, c);
    const k = `${r.label}${r.why ? ':' + r.why : ''} -> ${b.flagged ? 'flagged' : b.unknown ? 'silent-drop' : 'passes'}`;
    m[k] = (m[k] || 0) + 1;
    if (r.label !== 'on-token' && !b.flagged) (misses[c] = 1);
    if (r.label === 'on-token' && b.flagged) (fps[c] = 1);
  }
  console.log('classifier label -> baseline outcome (class uses over #231/#253/#255):');
  for (const [k, n] of Object.entries(m).sort()) console.log(`  ${k}: ${n}`);
  console.log('baseline misses:', Object.keys(misses).join(' ') || '-');
  console.log('baseline flags that classifier calls on-token:', Object.keys(fps).join(' ') || '-');
  // synthetic edge cases absent from the recorded data (not counted above)
  const EDGE = { shadcn: ["bg-[var(--primary)]", "rounded-2xl", "shadow-[0_1px_2px_#0001]", "text-primry", "hover:bg-primary/90", "md:max-w-3xl", "bg-slate-900/50", "fixed", "inset-0", "z-50", "z-[999]", "md:fixed"], theme255: ["p-gutter", "p-[1.75rem]", "text-[#1f58f5]", "rounded-card", "rounded-3xl", "font-display", "bg-brand-950"] };
  const edge = [];
  for (const [s, cs] of Object.entries(EDGE)) for (const c of cs) { const r = classify(c, s); const b = await baselineFlag(s, c); edge.push(`${s} ${c}: classifier=${r.label}${r.why ? ":" + r.why : ""} baseline=${b.flagged ? (b.lint ? "lint" : "reset-drop") : b.unknown ? "silent-drop" : "pass"}`); }
  console.log(edge.join("\n"));
  const out = path.join(HERE, 'result.json');
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  prev.baseline = { matrix: m, edge, misses: Object.keys(misses), falsePositives: Object.keys(fps) };
  fs.writeFileSync(out, JSON.stringify(prev, null, 1));
}
