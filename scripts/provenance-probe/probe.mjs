// O3 provenance existence probe (#183).
// Rerun (repo root, after `pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library`):
//   PW_CORE=<playwright-core dir> CHROME=<chrome binary> TWB=<@tailwindcss/browser dist/index.global.js> \
//   node scripts/provenance-probe/probe.mjs
// Writes scripts/provenance-probe/result.json. Serves on port 5600.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const { chromium } = createRequire(import.meta.url)(process.env.PW_CORE);
const PORT = 5600;
const BARO = fs.readFileSync(path.join(root, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), 'utf8');
const TWB = process.env.TWB ? fs.readFileSync(process.env.TWB, 'utf8') : '';
const page0 = fs.readFileSync(path.join(here, 'page.html'), 'utf8');
const engines = {
  baro: `<script>${BARO.replace(/<\/script/g, '<\\/script')}</script><script>
    const G = window.BaroCSSBrowser || window.BaroCSS;
    G.baroStart({ config: { theme: { extend: { colors: { brand: '#ff3366' } } } } });
    window.__G = G; document.addEventListener('DOMContentLoaded', () => { window.__rt = G.getRuntime({}); });</script>`,
  tw: `<script>${TWB.replace(/<\/script/g, "<\\/script")}</script><style type="text/tailwindcss">@theme { --color-brand: #ff3366; }</style>`,
};
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(page0.replace('<!--ENGINE-->', () => engines[q.url.slice(1)] || '')); }).listen(PORT);
const IDS = ['e1', 'e2', 'e3', 'e4', 'e5'];

// Path A: browser data only (DOM + getComputedStyle + CSSOM).
function browserOnly(IDS) {
  const out = {}; const rules = [];
  const walk = (list, ctx) => { for (const r of list) {
    if (r.cssRules && !r.selectorText) walk(r.cssRules, [...ctx, r.conditionText || r.media?.mediaText || r.name || r.constructor.name]);
    if (r.selectorText) { rules.push({ r, ctx }); if (r.cssRules?.length) walk(r.cssRules, [...ctx, "nested"]); } } };
  for (const s of document.styleSheets) { try { walk(s.cssRules, []); } catch {} }
  const rootStyle = getComputedStyle(document.documentElement);
  for (const id of IDS) {
    const el = document.getElementById(id); const cs = getComputedStyle(el); const perClass = {};
    for (const c of el.classList) {
      const esc = '.' + CSS.escape(c);
      perClass[c] = rules.filter(({ r }) => r.selectorText.includes(esc)).map(({ r, ctx }) => {
        let now = null, ignoringState = null;
        try { now = el.matches(r.selectorText); } catch {}
        try { ignoringState = el.matches(r.selectorText.replace(/:(hover|focus|active)\b/g, '')); } catch {}
        return { ctx, sel: r.selectorText, css: r.style.cssText, matchesNow: now, ignoringState,
          vars: [...r.style.cssText.matchAll(/var\((--[\w-]+)/g)].map(m => [m[1], rootStyle.getPropertyValue(m[1]).trim()]) };
      });
    }
    out[id] = { classes: [...el.classList], perClass, computed: { display: cs.display, padding: cs.padding, bg: cs.backgroundColor, boxShadow: cs.boxShadow, width: cs.width, textWrap: cs.textWrap } };
  }
  return out;
}
// Path B: BaroCSS runtime APIs.
function baroApi(IDS) {
  const rt = window.__rt; if (!rt) return null;
  const out = { globals: Object.keys(window.__G), methods: Object.getOwnPropertyNames(Object.getPrototypeOf(rt)) };
  for (const id of IDS) out[id] = [...document.getElementById(id).classList].map(c => ({ c, has: rt.has(c), css: rt.getCss(c) ?? null }));
  return out;
}
// Path A': CDP CSS.getMatchedStylesForNode (what DevTools-driving agents see).
async function cdpMatched(cdp, id) {
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
  const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  return (m.matchedCSSRules || []).filter(x => x.rule.origin !== 'user-agent').map(x => ({
    sel: x.rule.selectorList.text, media: (x.rule.media || []).map(q => q.text), layers: (x.rule.layers || []).map(l => l.text),
    props: x.rule.style.cssProperties.filter(p => p.text).map(p => p.name + ':' + p.value) }));
}
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const result = {};
for (const eng of ['baro', 'tw']) for (const width of [500, 1000]) {
  const pg = await browser.newPage({ viewport: { width, height: 600 } });
  await pg.goto(`http://localhost:${PORT}/${eng}`); await pg.waitForTimeout(1000);
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const r = { browser: await pg.evaluate(browserOnly, IDS), baro: await pg.evaluate(baroApi, IDS), cdp: {} };
  for (const id of IDS) r.cdp[id] = await cdpMatched(cdp, id);
  const { root: d } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: d.nodeId, selector: '#e1' });
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
  r.e1ForcedHoverBg = await pg.evaluate(() => getComputedStyle(document.getElementById('e1')).backgroundColor);
  result[`${eng}@${width}`] = r; await pg.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(result, null, 1));
console.log('wrote result.json');
