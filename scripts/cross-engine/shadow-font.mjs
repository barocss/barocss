// #374 diagnostic: Firefox shows font-family differing on every element for the #327 shadow-root arm
// (BrowserRuntime({ root: shadowRoot })). Prints the computed font-family inside the shadow root and where
// the runtime's preflight font rule landed, per engine.
//   PW_DIR=... [CHROME=...] ENGINE=firefox node scripts/cross-engine/shadow-font.mjs
import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/'));
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const fs = await import('node:fs');
const REF = await (await req('tailwindcss').compile('@import "tailwindcss";', { base: twDir, loadStylesheet: async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id);
  return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; } })).build(['p-4', 'text-sm', 'font-bold']);
const ENGINE = process.env.ENGINE || 'chromium';
const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw[ENGINE].launch({ executablePath: ENGINE === 'chromium' ? process.env.CHROME : undefined });
const p = await browser.newPage();
await p.setContent('<!doctype html><html><head><style>body{font-family:Georgia}</style></head><body><div id="h"></div></body></html>');
await p.addScriptTag({ path: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs') });
const r = await p.evaluate(async (REF) => {
  const rh = document.createElement('div'); document.body.append(rh); const rs = rh.attachShadow({ mode: 'open' });
  rs.innerHTML = '<style></style><span class="font-bold">x</span>'; rs.firstChild.textContent = REF;
  const sr = document.getElementById('h').attachShadow({ mode: 'open' });
  sr.innerHTML = '<div class="p-4 text-sm"><span class="font-bold">x</span></div>';
  new BaroCSS.BrowserRuntime({ root: sr, config: {} });
  await new Promise((ok) => setTimeout(ok, 500));
  const el = sr.querySelector('span'), host = sr.host;
  const sheets = [...sr.adoptedStyleSheets, ...[...sr.querySelectorAll('style')].map((s) => s.sheet)];
  const fontRules = [];
  const walk = (list) => { for (const x of list) { if (x.cssRules && !x.style) walk(x.cssRules); else if (x.style && x.style.getPropertyValue('font-family')) fontRules.push(x.selectorText + ' {' + x.style.getPropertyValue('font-family').slice(0, 200)); } };
  sheets.forEach((s) => walk(s.cssRules));
  return { ref: getComputedStyle(rs.querySelector('span')).fontFamily, span: getComputedStyle(el).fontFamily, div: getComputedStyle(sr.firstElementChild).fontFamily, host: getComputedStyle(host).fontFamily,
    adopted: sr.adoptedStyleSheets.length, styleEls: sr.querySelectorAll('style').length, fontRules: fontRules.slice(0, 4) };
}, REF);
console.log(ENGINE, JSON.stringify(r));
await browser.close();
