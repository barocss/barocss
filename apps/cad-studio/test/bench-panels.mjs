// The App's cost of a selection change (the coordinator's item 5, from the GPU lane's G13 profile: a bracket click cost
// 55 ms there, 36 of it React's jsxDEV): the main thread's task time for a bracket clicked from idle, for the selection
// cleared, and for 60 pointer moves across 120 placed brackets — on the dev server (React's development build) and on a
// production build (vite build, served by vite preview), each run `RUNS` times, the median kept. Not a budget: a
// measurement, printed. Opt-in (needs a browser):
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [BUILDS=dev,prod] [PROFILE=1] node test/bench-panels.mjs
// PROFILE=1: the session's first click under the CPU profiler, its functions by self time (the production build unminified then).
// TRACE=1: the session's first click traced (devtools.timeline): the main thread's time by event (style, layout, paint, script, compile).
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const vite = await import('vite');
const RUNS = Number(process.env.RUNS ?? 5), builds = (process.env.BUILDS ?? 'dev,prod').split(',');
const bracket = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] }, { kind: 'extrude', sketch: 0, height: 6 },
  { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 2 }, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [24, 6], radius: 2 }],
  outputs: { b1: { node: 3, side: 'solid' } } };
const N = 120, side = Math.ceil(Math.sqrt(N));
const many = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {},
  instances: Array.from({ length: N }, (_, k) => ({ id: `i${k}`, name: `bracket ${k}`, doc: bracket, position: [40 * (k % side), 20 * Math.floor(k / side), 0], rotation: [0, 0, 0], part: { id: 'bracket', rev: 'A' } })) };
const tmp = fs.mkdtempSync(join(os.tmpdir(), 'cad-bench-panels-')), file = join(tmp, 'brackets.bcad'); fs.writeFileSync(file, JSON.stringify(many));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function serve(build) {
  if (build === 'dev') { const s = await vite.createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52061, strictPort: false }, logLevel: 'error' }); await s.listen(); return { url: s.resolvedUrls.local[0], close: () => s.close() }; }
  const outDir = join(tmp, 'dist');
  await vite.build({ root, configFile: join(root, 'vite.config.ts'), build: { outDir, emptyOutDir: true, ...(process.env.PROFILE ? { minify: false } : {}) }, logLevel: 'error' });
  const p = await vite.preview({ root, configFile: join(root, 'vite.config.ts'), build: { outDir }, preview: { port: 52062, strictPort: false }, logLevel: 'error' });
  return { url: p.resolvedUrls.local[0], close: () => p.close() };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const out = {};
try {
  for (const build of builds) {
    const srv = await serve(build), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
      const task = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value * 1000;
      const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 60000 });
      const timed = async (act) => { await page.waitForTimeout(400); const t0 = await task(); await act(); await page.waitForTimeout(300); return await task() - t0; };
      await page.goto(srv.url); await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
      await page.setInputFiles('input[aria-label="Model file"]', file);
      await page.waitForFunction(() => /bracket 119/.test(document.querySelector('.outliner')?.textContent ?? '') || document.querySelectorAll('.outliner .ol').length >= 100, null, { timeout: 60000 }); await idle(); await page.waitForTimeout(1500);
      const b = await page.locator('canvas.vp-canvas').boundingBox(), ax = b.x + b.width / 2, ay = b.y + b.height / 2;
      let top;
      if (process.env.PROFILE) {
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
        const tp0 = await task(); await page.mouse.click(ax + 13, ay + 7); await page.waitForTimeout(1000); const tp = await task() - tp0;
        const { profile } = await cdp.send('Profiler.stop'), self = new Map(), dt = new Map();
        // (Self time: each sample's time to its node; nodes by function and file.)
        profile.samples.forEach((id, k) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[k] ?? 0) / 1000));
        for (const n of profile.nodes) { const f = n.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(key, (self.get(key) ?? 0) + (dt.get(n.id) ?? 0)); }
        const sum = (re) => [...self].filter(([k]) => re.test(k)).reduce((x, [, v]) => x + v, 0);
        top = [`task ${tp.toFixed(1)} ms around the session's first click; program ${sum(/^\(program\)/).toFixed(1)}, GC ${sum(/^\(garbage collector\)/).toFixed(1)}, JS ${sum(/^(?!\((idle|program|garbage collector)\))/).toFixed(1)}`,
          ...[...self].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(2)} ms ${k}`)];
      }
      if (process.env.PROFILE) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
      let trace;
      if (process.env.TRACE) {
        const events = []; cdp.on('Tracing.dataCollected', d => events.push(...d.value));
        const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
        await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
        await page.mouse.click(ax + 13, ay + 7); await page.waitForTimeout(1000);
        await cdp.send('Tracing.end'); await done;
        // (The renderer's main thread: the thread its RunTask events run on most.)
        const main = new Map(); for (const e of events) if (e.name === 'RunTask' && e.dur) main.set(`${e.pid}:${e.tid}`, (main.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur);
        const [mt] = [...main].sort((a, b) => b[1] - a[1])[0] ?? [];
        const by = new Map(); for (const e of events) if (e.ph === 'X' && e.dur && `${e.pid}:${e.tid}` === mt && e.name !== 'RunTask' && e.name !== 'ThreadControllerImpl::RunTask') by.set(e.name, (by.get(e.name) ?? 0) + e.dur / 1000);
        trace = [`main thread tasks ${((main.get(mt) ?? 0) / 1000).toFixed(1)} ms`, ...[...by].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${v.toFixed(2)} ms ${k}`)];
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      }
      const click = [], clear = [], hover = [];
      for (let r = 0; r < RUNS; r++) {
        click.push(await timed(() => page.mouse.click(ax + 13, ay + 7)));
        clear.push(await timed(() => page.keyboard.press('Escape')));
        hover.push(await timed(async () => { for (let i = 0; i < 60; i++) { await page.mouse.move(ax - 300 + 10 * i, ay - 40 + (i % 7) * 12); await page.waitForTimeout(16); } }) / 60);
      }
      out[build] = { ...(top ? { top } : {}), ...(trace ? { trace } : {}),  clickMS: +median(click).toFixed(1), clearMS: +median(clear).toFixed(1), hoverMSPerMove: +median(hover).toFixed(2), runs: RUNS, all: { click: click.map(x => +x.toFixed(1)), clear: clear.map(x => +x.toFixed(1)) } };
    } finally { await page.close(); await srv.close(); }
  }
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(JSON.stringify({ load: os.loadavg().map(x => +x.toFixed(1)), ...out }, null, 1));
