// #265 runtime cost at scale: BaroCSS #242 companion recipe vs @tailwindcss/browser.
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=6465] [CHURN_MIN=5] [SCALES=1000,5000,20000] [ARMS=baro,twb] [BARO_GC=0] node scripts/scale-probe/run.mjs
// #269: BARO_GC=0 boots the baro arm with gc:false (pre-#269 behaviour). Churn also checks every animation frame
// that each live element's sentinel p-[Kpx] is applied (unstyledFrames = frames with >=1 unstyled element).
// Writes result.json (ignored by git).
// SUMMARY (2026-09-26, 1 run, churn shortened to 5 min). baro = getRuntime({skipExisting,cssVarPrefix:'tw'})+observe; twb = @tailwindcss/browser.
//   arm  N    styled p50/p95  TBT  worstLT  recalc  layout  heapMB  CSS KB  rules
//   baro 1k   47.8/47.8       0    0        2.7     7.2     2.8     131     1280
//   baro 5k   43.0/48.3       0    0        30.7    10.3    5.5     574     6098
//   baro 20k  42.1/49.3*      0    0        363     39      12.4    1720    20119
//   twb  1k   17.2/17.2       0    0        3.3     8.1     3.7     118     1196
//   twb  5k   20.3/32.2       0    0        33      19.6    9.9     567     5744
//   twb  20k  67.0/105.5*     668  105      486     132     27.7    1748    19262     (* one batch hit the 5s cap in each arm)
// Churn (1000 live els, 50 replaced / 200ms), heap MB | CSS KB | rules at 0 / 2.5 / 5 min:
//   baro 5.5/76/144 | 574/9984/19134 | 6.1k/148k/289k  (77.5k classes generated)
//   twb  9.7/141/207 | 567/8058/11529 | 5.7k/108k/157k (41.8k generated: the page fell behind the 200ms tick)
// Rules for removed classes are never reclaimed in either arm; growth is linear in classes ever seen.
// Scale: N unique classes, batches of 100 elements x 5 classes; styled = first rAF where the batch's last element
// has its unique p-[Kpx] applied. Churn: every 200ms replace 50 elements (fresh unique classes), sample every 30s.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PORT = Number(process.env.PROBE_PORT || 6465);
const CHURN_MIN = Number(process.env.CHURN_MIN || 5);
const SCALES = (process.env.SCALES || '1000,5000,20000').split(',').filter(Boolean).map(Number);
const ARMS = (process.env.ARMS || 'baro,twb').split(',');
const BARO_GC = process.env.BARO_GC !== '0';
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const corpusSrc = fs.readFileSync(path.join(ROOT, 'packages/barocss/tests/compat/corpus.ts'), 'utf8');
const CORPUS = [...corpusSrc.matchAll(/\["([^"]+)",\s*\d+\]/g)].map((m) => m[1]);

// Generator (runs in page). Element k: p-[Kpx] sentinel + variant x colour/opacity + arbitrary width/colour + mt or corpus token.
const GEN = `
var COLORS=['red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose','slate','gray','zinc','neutral','stone'];
var SH=[50,100,200,300,400,500,600,700,800,900,950], VAR=['','hover:','focus:','md:','lg:','sm:','xl:','dark:','md:hover:','active:','group-hover:','disabled:'];
var CORPUS=${JSON.stringify(CORPUS)};
function gen(k){
  var v=VAR[k%VAR.length], c=COLORS[k%COLORS.length], s=SH[(k>>2)%SH.length], op=5+(k%19)*5;
  return ['p-['+(k+1)+'px]', v+'bg-'+c+'-'+s+'/'+op, v+'w-['+(k+1)+'px]',
    v+'text-[#'+((k*2654435761>>>8)&0xffffff).toString(16).padStart(6,'0')+']',
    (k%3?v+'mt-['+(k+1)+'px]':CORPUS[k%CORPUS.length])].join(' ');
}`;
const BOOT = {
  baro: `<script src="/baro.js"></script><script>var rt=BaroCSS.getRuntime({skipExisting:true,gc:${BARO_GC},config:{cssVarPrefix:'tw'}});rt.observe(document.body,{scan:true});</script>`,
  twb: `<script src="/twb.js"></script>`,
};
const page = (arm) => `<!doctype html><html><head><meta charset="utf-8"><script>${GEN}
window.__lt=[];new PerformanceObserver(function(l){l.getEntries().forEach(function(e){__lt.push(e.duration)})}).observe({type:'longtask',buffered:true});</script>
</head><body><div id="root"></div>${BOOT[arm]}</body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (t, b) => { r.writeHead(200, { 'content-type': t }); r.end(b); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm')));
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const cssStat = () => { let b = 0, n = 0; const walk = (rs) => { for (const r of rs) { if (r.cssRules && r.cssRules.length) walk(r.cssRules); else n++; } };
  for (const s of document.styleSheets) { try { for (const r of s.cssRules) b += r.cssText.length; walk(s.cssRules); } catch {} } return { kb: b / 1024, rules: n }; }; // rules = leaf rules
async function open(arm) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const cdp = await p.context().newCDPSession(p); await cdp.send('Performance.enable');
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}`); await p.waitForTimeout(500);
  const metrics = async () => {
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    return { recalc: m.RecalcStyleDuration * 1000, layout: m.LayoutDuration * 1000, heap: m.JSHeapUsedSize / 1048576 };
  };
  return { p, metrics };
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
const fix = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(1) : v));
const res = { scale: {}, churn: {} };
for (const arm of ARMS) for (const N of SCALES) {
  const { p, metrics } = await open(arm);
  const m0 = await metrics();
  const times = await p.evaluate(async (N) => {
    const root = document.getElementById('root'), out = []; let k = 0;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    for (let b = 0; b < N / 500; b++) {
      const frag = document.createDocumentFragment(); let last;
      for (let i = 0; i < 100; i++) { last = document.createElement('div'); last.className = gen(k++); last.textContent = 'x'; frag.appendChild(last); }
      const want = k + 'px', t0 = performance.now(); root.appendChild(frag);
      await Promise.resolve(); // #270: let the MutationObserver callback run before the first check
      while (getComputedStyle(last).paddingTop !== want) { if (performance.now() - t0 > 5000) break; await frame(); }
      out.push(performance.now() - t0);
    }
    return out;
  }, N);
  await p.waitForTimeout(300);
  const lt = await p.evaluate(() => __lt), m1 = await metrics(), css = await p.evaluate(cssStat);
  res.scale[`${arm}-${N}`] = { p50: q(times, 0.5), p95: q(times, 0.95), timeouts: times.filter((t) => t > 5000).length,
    tbt: lt.reduce((a, d) => a + Math.max(0, d - 50), 0), worstLT: Math.max(0, ...lt),
    recalc: m1.recalc - m0.recalc, layout: m1.layout - m0.layout, heap: m1.heap, ...css };
  console.log(arm, N, fix(res.scale[`${arm}-${N}`]));
  await p.close();
}
for (const arm of CHURN_MIN > 0 ? ARMS : []) {
  const { p, metrics } = await open(arm);
  await p.evaluate(() => { const root = document.getElementById('root'); window.__k = 0; for (let i = 0; i < 1000; i++) { const d = document.createElement('div'); d.dataset.k = __k; d.className = gen(__k++); d.textContent = 'x'; root.appendChild(d); } });
  await p.waitForTimeout(1500);
  // #269: per-frame correctness: every live element's sentinel p-[(k+1)px] must be applied.
  await p.evaluate(() => { window.__chk = { frames: 0, bad: 0, badEls: 0, sample: null }; const tick = () => {
    let bad = 0; for (const d of document.getElementById('root').children) { if (d.dataset.k % 3 === 0) continue; /* k%3==0 carries a corpus token that may set padding */ if (getComputedStyle(d).paddingTop !== (+d.dataset.k + 1) + 'px') { bad++; if (!__chk.sample) __chk.sample = d.className; } }
    __chk.frames++; if (bad) { __chk.bad++; __chk.badEls += bad; } window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); });
  const samples = [];
  const sample = async (t) => {
    const m = await metrics(), c = await p.evaluate(cssStat);
    // element 0's classes (p-[1px], w-[1px]) are removed after the first tick: are their rules ever dropped?
    const kept = await p.evaluate(() => { let n = 0; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (/\.p-\\\[1px\\\]|\.w-\\\[1px\\\]/.test(r.cssText)) n++; } catch {} } return n; });
    samples.push({ t, heap: m.heap, kb: c.kb, rules: c.rules, removedRulesStillPresent: kept, check: await p.evaluate(() => __chk), live: await p.evaluate(() => document.getElementById('root').children.length), made: await p.evaluate(() => __k) });
    console.log(arm, 'churn', fix(samples.at(-1)));
  };
  await sample(0);
  await p.evaluate(() => { window.__iv = setInterval(() => { const root = document.getElementById('root'); for (let i = 0; i < 50; i++) { root.firstChild.remove(); const d = document.createElement('div'); d.dataset.k = __k; d.className = gen(__k++); d.textContent = 'x'; root.appendChild(d); } }, 200); });
  for (let t = 30; t <= CHURN_MIN * 60; t += 30) { await p.waitForTimeout(30000); await sample(t); }
  await p.evaluate(() => clearInterval(__iv));
  res.churn[arm] = samples;
  await p.close();
}
fs.writeFileSync(path.resolve(HERE, process.env.RESULT || 'result.json'), JSON.stringify(res, null, 1));
await browser.close(); srv.close();
