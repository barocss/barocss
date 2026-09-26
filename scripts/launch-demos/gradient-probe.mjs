// #379 diagnosis: why bg-gradient-* does not render inside a shadow root (BrowserRuntime({ root })) on 0.10.1.
// Rerun: PW_DIR=… CHROME=… node scripts/launch-demos/gradient-probe.mjs
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'x.js'))('playwright-core');
const BARO = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), 'utf8');
const CASES = { gradient: ['bg-gradient-to-b from-slate-900 to-slate-800', 'background-image'], shadow: ['shadow-lg', 'box-shadow'],
  ring: ['ring-2 ring-indigo-500', 'box-shadow'], translate: ['translate-x-2', 'translate'], rotate: ['rotate-3', 'rotate'],
  scale: ['scale-110', 'scale'], blur: ['blur-sm', 'filter'], backdrop: ['backdrop-blur', 'backdrop-filter'], plain: ['bg-slate-900', 'background-color'] };
const html = `<!doctype html><body><div id="doc">${Object.entries(CASES).map(([k, [c]]) => `<div data-k="${k}" class="${c}">x</div>`).join('')}</div><div id="host"></div><script>${BARO}</script></body>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function measure(mode) {
  const p = await browser.newPage();
  await p.setContent(html);
  return p.evaluate(async ({ mode, CASES }) => {
    const host = document.getElementById('host'), sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = document.getElementById('doc').innerHTML;
    const scope = mode === 'doc' ? document.getElementById('doc') : sr;
    if (mode === 'doc') BaroCSS.getRuntime({}).observe(document.getElementById('doc'), { scan: true });
    else new BaroCSS.BrowserRuntime({ root: sr, config: {} });
    await new Promise((r) => setTimeout(r, 400));
    const sheets = [...(mode === 'doc' ? document.styleSheets : [...sr.styleSheets, ...sr.adoptedStyleSheets])];
    const text = sheets.map((s) => [...s.cssRules].map((r) => r.cssText).join('\n')).join('\n');
    const props = text.match(/@property [^{]+\{[^}]*\}/g) || [];
    if (mode === 'shadow+docprop') { const s = new CSSStyleSheet(); s.replaceSync(props.join('\n')); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; await new Promise((r) => setTimeout(r, 100)); }
    const out = { propertyRules: props.length };
    for (const [k, [, prop]] of Object.entries(CASES)) { const v = getComputedStyle(scope.querySelector(`[data-k="${k}"]`)).getPropertyValue(prop); out[k] = v === 'none' || v === '' || v === 'rgba(0, 0, 0, 0)' ? 'NONE' : 'ok'; }
    return out;
  }, { mode, CASES });
}
for (const m of ['doc', 'shadow', 'shadow+docprop']) console.log(m.padEnd(15), JSON.stringify(await measure(m)));
await browser.close();
