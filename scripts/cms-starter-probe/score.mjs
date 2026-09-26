// #282 scorer: block-element parity of an agent's build vs a reference build, at FCP and after hydration,
// plus shell damage vs the untouched baseline. Each target is a running server (static `dist` or the agent's own preview).
// Usage: PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> \
//   node scripts/cms-starter-probe/score.mjs <refUrl> <baselineUrl> <candidateUrl> [label]
// CPU 4x + Fast 3G via CDP. FCP snapshot = computed styles taken in a PerformanceObserver('paint') callback.
import { createRequire } from 'node:module';
import path from 'node:path';
const req = createRequire(path.join(process.env.PW_DIR, 'node_modules/'));
const { chromium } = req('playwright-core');
const [REF, BASE, CAND, LABEL = 'cand'] = process.argv.slice(2);
const PAGES = ['opus-hero', 'opus-feature-grid', 'opus-comparison-table', 'haiku-callout', 'haiku-testimonial', 'haiku-cta']
  .map((s) => `/posts/cms/${s}/`).concat(['/']);
const PROPS = ['display', 'position', 'margin-top', 'margin-bottom', 'margin-left', 'padding-top', 'padding-left', 'max-width',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color',
  'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-left-width',
  'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'gap', 'grid-template-columns', 'flex-direction',
  'justify-content', 'align-items', 'text-align', 'text-decoration-line', 'list-style-type', 'z-index'];
const INIT = `(() => {
  const P = ${JSON.stringify(PROPS)};
  const skip = (e) => /^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(e.tagName) || e.closest('astro-island template');
  window.__snap = () => {
    const sig = (e) => { const c = getComputedStyle(e); return P.map((p) => c.getPropertyValue(p)).join('|'); };
    const all = [...document.body.querySelectorAll('*')].filter((e) => !skip(e));
    return { block: all.filter((e) => e.closest('[data-block]') && !e.matches('[data-block]')).map(sig),
             shell: all.filter((e) => !e.closest('[data-block]')).map((e) => e.tagName + ':' + sig(e)) };
  };
  new PerformanceObserver((l) => { for (const x of l.getEntries()) if (x.name === 'first-contentful-paint' && !window.__fcp) window.__fcp = window.__snap(); })
    .observe({ type: 'paint', buffered: true });
})();`;
async function snap(browser, base, p, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 });
  }
  await page.addInitScript(INIT);
  await page.goto(base + p, { waitUntil: 'load', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ fcp: window.__fcp || null, hyd: window.__snap() }));
  await ctx.close();
  return r;
}
const eq = (a, b) => a.filter((x, i) => x === b[i]).length;
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const out = { label: LABEL, pages: {} };
let tot = 0, fcpOk = 0, hydOk = 0, shellTot = 0, shellDiff = 0;
for (const p of PAGES) {
  const ref = await snap(browser, REF, p, false), base = await snap(browser, BASE, p, false);
  const c = await snap(browser, CAND, p, true);
  const n = ref.hyd.block.length, f = c.fcp ? eq(c.fcp.block, ref.hyd.block) : 0, h = eq(c.hyd.block, ref.hyd.block);
  const s = base.hyd.shell.length, d = s - eq(c.hyd.shell, base.hyd.shell) + Math.abs(c.hyd.shell.length - s);
  tot += n; fcpOk += f; hydOk += h; shellTot += s; shellDiff += d;
  out.pages[p] = { blockEls: n, fcp: f, hydrated: h, shellEls: s, shellDiff: d, candBlockEls: c.hyd.block.length };
}
await browser.close();
Object.assign(out, { blockEls: tot, fcpParity: +(fcpOk / tot).toFixed(3), hydratedParity: +(hydOk / tot).toFixed(3), shellEls: shellTot, shellDamage: shellDiff });
console.log(JSON.stringify(out));
