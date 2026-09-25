// E-008 L2 driver (method steps 2 & 4). NOT a change to any frozen E-007 logic: it imports the frozen classify() from
// classify.mjs and only adds box-shadow measurement + Tailwind-4.1.13 comparison ("output/task wiring").
// Usage from repo root, after `pnpm --filter barocss build:library`:
//   PW_MCP_DIR=<dir with node_modules/playwright-core> [CHROME_PATH=…] node .ai/evidence/E-008/ring.mjs <baseline|postfix>
// → <label>.json ; exit 1 if the expected gating for that phase is not met.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './env.mjs';
import { classify, TW_VERSION } from './classify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const label = process.argv[2] || 'baseline';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const req = createRequire(join(ROOT, 'package.json'));
const preq = createRequire(join(process.env.PW_MCP_DIR, 'package.json'));
const { chromium } = preq('playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The four ring tokens under test, and the no-regression control set (contract step 2).
const RING = ['ring-1', 'ring-2', 'focus:ring-2', 'focus:ring-offset-2'];
const CONTROLS = ['shadow-sm', 'shadow-xl', 'shadow-none', 'p-4', 'bg-blue-600', 'md:grid-cols-3', 'rounded-2xl'];
const PROBE_COLOR = 'rgb(17, 24, 39)'; // fixed so currentColor is identical for BaroCSS and Tailwind ("same element")

// ---- Tailwind 4.1.13 reference CSS (same compiler path as classify.mjs's twEmits) ----
const TW_DIR = dirname(req.resolve('tailwindcss/package.json'));
const tw = req('tailwindcss');
const loadStylesheet = async (id, base) => {
  const p = id === 'tailwindcss' ? join(TW_DIR, 'index.css')
    : id.startsWith('tailwindcss/') ? join(TW_DIR, id.slice('tailwindcss/'.length).replace(/(\.css)?$/, '.css')) : resolve(base, id);
  return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') };
};
const twc = await tw.compile('@import "tailwindcss";', { base: TW_DIR, loadStylesheet });
const twCss = twc.build(RING.flatMap((t) => [t, t.replace(/^[^:]+:/, '')]));

// Measure computed box-shadow for each ring token on a bare probe with a fixed color.
// focus:* tokens use a <button> that we focus; others a <div>. Returns { [token]: boxShadow }.
async function measure(page, tokens) {
  return page.evaluate(({ tokens, color }) => {
    const out = {};
    for (const t of tokens) {
      const focus = t.startsWith('focus:');
      const el = document.createElement(focus ? 'button' : 'div');
      el.className = t; el.textContent = 'x'; el.style.color = color;
      document.body.appendChild(el);
      if (focus) el.focus();
      out[t] = getComputedStyle(el).boxShadow;
      el.remove();
    }
    return out;
  }, { tokens, color: PROBE_COLOR });
}

const app = await startApp('D');
const b = await chromium.launch({ executablePath: CHROME });
const out = { label, tailwind: TW_VERSION, url: app.url, styled: null, ring: {}, controls: {}, ringPass: true, controlsPass: true };
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

  const cls = await classify(p, [...RING, ...CONTROLS]);
  const bcShadow = await measure(p, RING);

  // --- Tailwind reference page (same browser, blank doc, injected TW css) ---
  const tp = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await tp.setContent('<!doctype html><html><head><style id="tw"></style></head><body></body></html>');
  await tp.evaluate((css) => { document.getElementById('tw').textContent = css; }, twCss);
  const twShadow = await measure(tp, RING);

  for (const t of RING) {
    const c = cls[t];
    const resolved = c.class === 'RESOLVED';
    const bs = bcShadow[t], ref = twShadow[t];
    const shadowEqual = bs === ref;
    const rec = { class: c.class, resolved, boxShadow: bs, twBoxShadow: ref, shadowEqual, nonEmpty: bs !== 'none' && !!bs, undefinedVars: c.undefinedVars, bcDecls: c.bcDecls };
    out.ring[t] = rec;
    // Phase gating: baseline expects PARITY-MISS (not resolved OR not equal); postfix expects RESOLVED AND shadowEqual.
    if (label === 'baseline') { if (resolved && shadowEqual) out.ringPass = false; }
    else { if (!resolved || !shadowEqual) out.ringPass = false; }
  }
  for (const t of CONTROLS) {
    const c = cls[t];
    const ok = c.class === 'RESOLVED';
    out.controls[t] = { class: c.class, ok, undefinedVars: c.undefinedVars };
    if (!ok) out.controlsPass = false;
  }
  await p.close(); await tp.close();
} finally { await b.close(); app.stop(); }

writeFileSync(join(HERE, `${label}.json`), JSON.stringify(out, null, 2) + '\n');
for (const t of RING) { const r = out.ring[t]; console.log((label === 'baseline' ? (r.resolved && r.shadowEqual ? 'UNEXPECTED-OK' : 'miss') : (r.resolved && r.shadowEqual ? 'ok' : 'FAIL')).padEnd(6), t, r.class, '| bc:', JSON.stringify(r.boxShadow), '| tw:', JSON.stringify(r.twBoxShadow)); }
for (const t of CONTROLS) console.log((out.controls[t].ok ? 'ok' : 'FAIL').padEnd(6), t, out.controls[t].class);
console.log('styled', out.styled?.ok, '| ringPass', out.ringPass, '| controlsPass', out.controlsPass);
process.exit(out.styled?.ok && out.ringPass && out.controlsPass ? 0 : 1);
