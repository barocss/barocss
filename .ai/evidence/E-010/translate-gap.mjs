// E-010 F2 deterministic gap probe (browser-free L2). Shows WHY single-axis translate is NOT a composition-default
// gap and so was dropped from the batch: the integer tokens emit a percentage of the element (calc(N * 100%)) where
// Tailwind 4.1.13 emits spacing (calc(var(--spacing) * N)). Registering the missing --baro-translate-* @property
// default (the only fix the E-010 contract allows for F2) would make the declaration valid but leave the VALUE wrong
// (e.g. 400% vs 16px), so the token still cannot reach Tailwind parity. This is a value-formula defect, out of the
// contract's composition-default scope — Strategy re-scopes it.
//
// Usage from repo root, after `pnpm --filter barocss build:library`:
//   node .ai/evidence/E-010/translate-gap.mjs        → prints the per-token BaroCSS-vs-Tailwind translate values.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseClassToAst, createContext } from '../../../packages/barocss/dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(ROOT, 'package.json'));
const TW_DIR = dirname(req.resolve('tailwindcss/package.json'));
const tw = req('tailwindcss');
const loadStylesheet = async (id, base) => {
  const p = id === 'tailwindcss' ? join(TW_DIR, 'index.css')
    : id.startsWith('tailwindcss/') ? join(TW_DIR, id.slice('tailwindcss/'.length).replace(/(\.css)?$/, '.css')) : resolve(base, id);
  return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') };
};

const TOKENS = ['translate-x-4', 'translate-y-4', '-translate-x-1/2'];
const ctx = createContext({});

// BaroCSS emit for the token's translate declaration.
const bcTranslate = (t) => {
  const nodes = parseClassToAst(t, ctx);
  const d = nodes.find((n) => n.prop === 'translate');
  return d ? d.value : null;
};

// Tailwind 4.1.13 emit: the `.token { ... }` block's translate + --tw-translate-* declarations.
const twc = await tw.compile('@import "tailwindcss";', { base: TW_DIR, loadStylesheet });
const twCss = twc.build(TOKENS);
const twBlock = (t) => {
  const cls = t.replace(/\//g, '\\/');
  const re = new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '\\s*\\{([^}]*)\\}');
  const m = twCss.match(re);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
};

const rows = TOKENS.map((t) => ({ token: t, barocss: bcTranslate(t), tailwind: twBlock(t) }));
for (const r of rows) {
  console.log('token     :', r.token);
  console.log('  BaroCSS :', r.barocss);
  console.log('  Tailwind:', r.tailwind);
}
// The integer tokens differ in the value FORMULA (percentage vs spacing), independent of the undefined-var problem.
const integerMismatch = rows.filter((r) => /translate-[xy]-4/.test(r.token) && /100%/.test(r.barocss) && /--spacing/.test(r.tailwind));
console.log('\ninteger tokens using calc(N*100%) where Tailwind uses calc(var(--spacing)*N):',
  integerMismatch.map((r) => r.token).join(', ') || 'none');
console.log('=> F2 is a value-formula gap, not a composition-default gap; dropped from the E-010 batch.');
