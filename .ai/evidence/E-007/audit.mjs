// E-007 POST-HOC audit, written after the agent runs (it does not change or replace the committed classifier/grader;
// grading results in runs/*.json stand as recorded). Usage from repo root:
//   PW_MCP_DIR=… [CHROME_PATH=…] node .ai/evidence/E-007/audit.mjs → audit.json
// (a) Effect check of every PARITY-MISS token from runs/*.json plus controls: the token alone on a probe element,
//     computed-style change on the live BaroCSS dev page vs. on a Tailwind 4.1.13 reference page (setContent with the
//     compiled CSS for the same tokens, preflight included). focus:* tokens are checked on a focused <button>.
// (b) Preflight border-style: computed border-top-style of the site's header (`border-b`) on the dev page.
// (c) Source of the empty style="" seen on <input> elements after runs: fresh page, then the same aria snapshot and
//     screenshot calls Playwright MCP makes, checking inputs after each.
// (d) First-try tokens restricted to class="…"/className/classList contexts (the committed extractor's "class string"
//     rule also swept prose words from HTML template literals into AGENT; see SUMMARY).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './env.mjs';
import { stringLiterals } from './classify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const rq = createRequire(join(ROOT, 'package.json'));
const tw = rq('tailwindcss');
const TW_DIR = dirname(rq.resolve('tailwindcss/package.json'));
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runs = Object.fromEntries(readdirSync(join(HERE, 'runs')).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(HERE, 'runs', f), 'utf8'))]));
const misses = [...new Set(Object.values(runs).flatMap((r) => r.parity_misses.map((m) => m.token)))];
const CONTROLS = ['border', 'border-2', 'border-t', 'md:scale-[1.03]', 'shadow-sm', 'ring-2', 'focus:outline-none'];
const tokens = [...new Set([...misses, ...CONTROLS])];

const loadStylesheet = async (id, base) => { const p = id === 'tailwindcss' ? join(TW_DIR, 'index.css') : join(TW_DIR, id.replace(/^tailwindcss\//, '').replace(/(\.css)?$/, '.css')); return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') }; };
const twCss = (await tw.compile('@import "tailwindcss";', { base: TW_DIR, loadStylesheet })).build(tokens);

const effect = async (page, tok) => page.evaluate(async (tok) => {
  const focus = /(^|:)focus(-visible|-within)?:/.test(tok);
  const holder = document.createElement('div'); holder.style.position = 'relative'; holder.style.padding = '40px';
  const el = document.createElement(focus ? 'button' : 'div'); el.textContent = 'probe';
  holder.appendChild(el); document.body.prepend(holder);
  if (focus) el.focus();
  await new Promise((r) => setTimeout(r, 300));
  const snap = () => { const cs = getComputedStyle(el), o = {}; for (const k of cs) o[k] = cs.getPropertyValue(k); return o; };
  const c0 = snap(); el.className = tok; if (focus) el.focus();
  await new Promise((r) => setTimeout(r, 900));
  const c1 = snap();
  holder.remove();
  return Object.keys(c1).filter((k) => !k.startsWith('--') && c0[k] !== c1[k]).map((k) => `${k}: ${c0[k]} → ${c1[k]}`);
}, tok);

const app = await startApp('D');
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const out = { note: 'post-hoc; see header', effects: {}, preflight: null, emptyStyle: null, firstTryClassContexts: {} };
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const bc = await ctx.newPage(); await bc.goto(app.url); await bc.waitForSelector('body.baro-boot-done'); await sleep(400);
  const ref = await ctx.newPage(); await ref.setContent(`<!doctype html><html><head><style>${twCss}</style></head><body></body></html>`);
  for (const t of tokens) {
    const [e1, e2] = [await effect(bc, t), await effect(ref, t)];
    out.effects[t] = { fromRuns: misses.includes(t), barocss: e1.slice(0, 10), tailwind: e2.slice(0, 10), barocssNoEffect: e1.length === 0, tailwindHasEffect: e2.length > 0 };
    console.log(t, '| BC', e1.length, '| TW', e2.length);
  }
  out.preflight = await bc.evaluate(() => { const h = getComputedStyle(document.querySelector('header')); const star = getComputedStyle(document.querySelector('section div')); return { headerBorderBottomStyle: h.borderBottomStyle, headerBorderBottomWidth: h.borderBottomWidth, anyDivBorderTopStyle: star.borderTopStyle }; });
  out.preflight.tailwindReference = await ref.evaluate(() => { const d = document.createElement('div'); d.className = 'border-t'; document.body.appendChild(d); const s = getComputedStyle(d); return { borderTopStyle: s.borderTopStyle, borderTopWidth: s.borderTopWidth }; });
  const inputs = () => bc.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.getAttribute('style')));
  const steps = { afterLoad: await inputs() };
  await bc.locator('body').ariaSnapshot(); steps.afterAriaSnapshot = await inputs();
  await bc.screenshot(); steps.afterScreenshot = await inputs();
  await bc.setViewportSize({ width: 375, height: 900 }); await sleep(400); steps.after375 = await inputs();
  out.emptyStyle = steps;
} finally { await b.close(); app.stop(); }

// (d)
for (const [k, r] of Object.entries(runs)) {
  const call = r.tool_calls[r.first_try.call];
  const code = [call?.input?.function, call?.input?.code].filter(Boolean).join('\n');
  const toks = new Set();
  const split = (s) => s.split(/\s+/).filter((x) => x && !/[${}<>"'`;\\]/.test(x));
  for (const m of code.matchAll(/\bclass(?:Name)?\s*[=:]\s*\\?(["'])([^"'\n]*)\1/g)) split(m[2]).forEach((t) => toks.add(t));
  for (const m of code.matchAll(/\bclass(?:Name)?\s*=\s*`([^`]*)`/g)) split(m[1]).forEach((t) => toks.add(t));
  for (const m of code.matchAll(/classList\s*\.\s*(?:add|toggle|replace)\s*\(([^)]*)\)/g)) for (const l of stringLiterals(m[1])) split(l.text).forEach((t) => toks.add(t));
  const cls = r.classification_default_state;
  const c = { RESOLVED: 0, 'PARITY-MISS': 0, AGENT: 0, unclassified: 0 };
  for (const t of toks) c[cls[t]?.class ?? 'unclassified']++;
  out.firstTryClassContexts[k] = { counts: c, agent: [...toks].filter((t) => cls[t]?.class === 'AGENT'), notInCommittedFirstTry: [...toks].filter((t) => !r.first_try.tokens.includes(t)) };
}
writeFileSync(join(HERE, 'audit.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ preflight: out.preflight, emptyStyle: out.emptyStyle, firstTry: Object.fromEntries(Object.entries(out.firstTryClassContexts).map(([k, v]) => [k, v.counts])) }));
