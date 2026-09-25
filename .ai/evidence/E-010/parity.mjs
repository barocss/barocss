// E-010 L2 driver (method step 6). Reuses E-007/E-008's frozen classify()/env.mjs unchanged; adds only the
// per-family computed-declaration measurement + Tailwind-4.1.13 comparison ("output/task wiring") for the three
// parity-lane families F1 ring, F2 single-axis translate, F3 preflight border-style, plus the E-008 control set.
//
// For each family token it records: the classifier class (RESOLVED needs TW emit + BC apply with no undefined var),
// and whether the token's COMPUTED declaration on a bare probe equals Tailwind 4.1.13's for the same token on the
// same element. "Parity" = RESOLVED AND computed-equal. Controls must stay RESOLVED (no regression).
//
// Usage from repo root, after `pnpm --filter barocss build:library` (or full `pnpm check`):
//   PW_MCP_DIR=<dir resolving playwright-core> [CHROME_PATH=…] node .ai/evidence/E-010/parity.mjs
// → parity.json ; exit 1 if F1/F3 are not at parity or any control regresses (F2 is expected to MISS: it is dropped).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './env.mjs';
import { classify, TW_VERSION } from './classify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const req = createRequire(join(ROOT, 'package.json'));
const preq = createRequire(join(process.env.PW_MCP_DIR, 'package.json'));
const { chromium } = preq('playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROBE_COLOR = 'rgb(17, 24, 39)'; // fixed so currentColor is identical for BaroCSS and Tailwind ("same element")

// The three families under test (contract tokens) and the E-008 no-regression control set.
const FAM = {
  ring: { tokens: ['ring-1', 'ring-2', 'focus:ring-2', 'focus:ring-offset-2'], props: ['boxShadow'] },
  translate: { tokens: ['translate-x-4', 'translate-y-4', '-translate-x-1/2'], props: ['translate'] },
  border: { tokens: ['border', 'border-t'], props: ['borderTopWidth', 'borderTopStyle', 'borderRightWidth', 'borderRightStyle', 'borderBottomWidth', 'borderBottomStyle', 'borderLeftWidth', 'borderLeftStyle'] },
};
const CONTROLS = ['shadow-sm', 'shadow-xl', 'shadow-none', 'p-4', 'bg-blue-600', 'md:grid-cols-3', 'rounded-2xl'];
const ALL_TOKENS = Object.values(FAM).flatMap((f) => f.tokens);
const propsFor = (t) => Object.values(FAM).find((f) => f.tokens.includes(t)).props;

// ---- Tailwind 4.1.13 reference CSS (same compiler path as classify.mjs's twEmits) ----
const TW_DIR = dirname(req.resolve('tailwindcss/package.json'));
const tw = req('tailwindcss');
const loadStylesheet = async (id, base) => {
  const p = id === 'tailwindcss' ? join(TW_DIR, 'index.css')
    : id.startsWith('tailwindcss/') ? join(TW_DIR, id.slice('tailwindcss/'.length).replace(/(\.css)?$/, '.css')) : resolve(base, id);
  return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') };
};
const twc = await tw.compile('@import "tailwindcss";', { base: TW_DIR, loadStylesheet });
const twCss = twc.build(ALL_TOKENS.flatMap((t) => [t, t.replace(/^[^:]+:/, '')]));

// Measure the computed declarations that matter for each token on a bare probe with a fixed color/size.
// focus:* tokens use a <button> we focus; others a <div>. A fixed 100x100 box makes any % deterministic.
async function measure(page, tokens) {
  return page.evaluate(({ tokens, color, propMap }) => {
    const out = {};
    for (const t of tokens) {
      const focus = t.startsWith('focus:');
      const el = document.createElement(focus ? 'button' : 'div');
      el.className = t; el.textContent = 'x'; el.style.color = color; el.style.width = '100px'; el.style.height = '100px';
      document.body.appendChild(el);
      if (focus) el.focus();
      const cs = getComputedStyle(el);
      const rec = {};
      for (const p of propMap[t]) rec[p] = cs[p];
      out[t] = rec;
      el.remove();
    }
    return out;
  }, { tokens, color: PROBE_COLOR, propMap: Object.fromEntries(tokens.map((t) => [t, propsFor(t)])) });
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const app = await startApp('D');
const b = await chromium.launch({ executablePath: CHROME });
const out = { tailwind: TW_VERSION, url: app.url, styled: null, families: {}, controls: {}, familyPass: {}, controlsPass: true };
try {
  // --- BaroCSS live page ---
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(app.url);
  await p.waitForSelector('body.baro-boot-done', { timeout: 15000 });
  await sleep(400);
  out.styled = await p.evaluate(() => ({
    headerPosition: getComputedStyle(document.querySelector('header')).position,
    h1FontSize: getComputedStyle(document.querySelector('h1')).fontSize,
    barocssStyles: document.querySelectorAll('style[id^="barocss"]').length,
  }));
  out.styled.ok = out.styled.headerPosition === 'sticky' && parseFloat(out.styled.h1FontSize) > 32 && out.styled.barocssStyles > 0;

  const cls = await classify(p, [...ALL_TOKENS, ...CONTROLS]);
  const bc = await measure(p, ALL_TOKENS);

  // --- Tailwind reference page (same browser, blank doc, injected TW css) ---
  const tp = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await tp.setContent('<!doctype html><html><head><style id="tw"></style></head><body></body></html>');
  await tp.evaluate((css) => { document.getElementById('tw').textContent = css; }, twCss);
  const twm = await measure(tp, ALL_TOKENS);

  for (const [fam, { tokens }] of Object.entries(FAM)) {
    out.families[fam] = {};
    let pass = true;
    for (const t of tokens) {
      const c = cls[t];
      const resolved = c.class === 'RESOLVED';
      const computedEqual = eq(bc[t], twm[t]);
      const atParity = resolved && computedEqual;
      out.families[fam][t] = { class: c.class, resolved, computedEqual, atParity, bc: bc[t], tw: twm[t], undefinedVars: c.undefinedVars };
      if (!atParity) pass = false;
    }
    out.familyPass[fam] = pass;
  }
  for (const t of CONTROLS) {
    const c = cls[t];
    const ok = c.class === 'RESOLVED';
    out.controls[t] = { class: c.class, ok, undefinedVars: c.undefinedVars };
    if (!ok) out.controlsPass = false;
  }
  await p.close(); await tp.close();
} finally { await b.close(); app.stop(); }

writeFileSync(join(HERE, 'parity.json'), JSON.stringify(out, null, 2) + '\n');
for (const [fam, toks] of Object.entries(out.families)) {
  for (const [t, r] of Object.entries(toks)) {
    console.log((r.atParity ? 'PARITY' : 'MISS').padEnd(7), fam.padEnd(10), t.padEnd(18), r.class, '| eq:', r.computedEqual, '| bc:', JSON.stringify(r.bc), '| tw:', JSON.stringify(r.tw));
  }
}
for (const t of CONTROLS) console.log((out.controls[t].ok ? 'ok' : 'FAIL').padEnd(7), 'control'.padEnd(10), t, out.controls[t].class);
console.log('styled', out.styled?.ok, '| familyPass', JSON.stringify(out.familyPass), '| controlsPass', out.controlsPass);
// F1 ring and F3 border must reach parity and controls must not regress. F2 translate is DROPPED (expected MISS),
// so it does not gate this run; the JSON records its miss and the measured reason for the review.
process.exit(out.styled?.ok && out.familyPass.ring && out.familyPass.border && out.controlsPass ? 0 : 1);
