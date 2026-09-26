// #290 SSG probe: Next.js `next build` prerendered pages /g/client (build CSS + #242 runtime) and /g/inline (build CSS +
// build-time generateCssForHtml per page, inlined). Same app/setup as run-stream.mjs (make-next.mjs writes both).
// Rerun: PW_DIR=... CHROME=... [URL=http://localhost:6901] node scripts/stream-probe/run-ssg.mjs [runs=3]
// Metrics: match@first = share of block elements equal to /s/ref in the first rAF frame (what first paint shows);
// final; FCP; inline CSS bytes per page (raw); build-time gen ms is read from <app>/ssg-gen-ms.txt by hand.
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const URL = process.env.URL || 'http://localhost:6901';
const RUNS = +(process.argv[2] || 3);
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function once(p) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(URL + p);
  await page.waitForFunction(() => window.__r, null, { timeout: 30000, polling: 200 });
  const r = await page.evaluate(() => ({ ...window.__r, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    inline: [...document.querySelectorAll('style[data-barocss-ssr]')].reduce((n, s) => n + s.textContent.length, 0),
    html: document.documentElement.outerHTML.length }));
  await ctx.close(); return r;
}
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ref = await once('/s/ref');
const refSig = Object.fromEntries(Object.entries(ref.chunks).map(([i, f]) => [i, f[f.length - 1].sig]));
const share = (r, k) => { let s = 0, t = 0; for (const [i, fr] of Object.entries(r.chunks)) { const sig = fr[k === 'first' ? 0 : fr.length - 1].sig; t += sig.length; s += sig.filter((x, j) => x === refSig[i][j]).length; } return s / t; };
console.log('arm      match@first final  FCPms  inlineCssB  htmlB');
for (const arm of ['client', 'inline']) {
  const rs = []; for (let n = 0; n < RUNS; n++) rs.push(await once('/g/' + arm));
  console.log(arm.padEnd(8), med(rs.map((r) => share(r, 'first'))).toFixed(3).padEnd(11), med(rs.map((r) => share(r, 'last'))).toFixed(3).padEnd(6),
    String(Math.round(med(rs.map((r) => r.fcp)))).padEnd(6), String(rs[0].inline).padEnd(11), rs[0].html);
}
await browser.close();
