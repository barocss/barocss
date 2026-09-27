// #431: long-running AI chat. Appends N messages (top-level blocks cut from the recorded #364 Tailwind-prompt
// outputs, scripts/mcp-model-outputs/outputs-tw, plus UNIQUE generated arbitrary-value classes per message) into a
// page running the prebuilt @barocss/browser UMD (new BrowserRuntime({ gc }) + observe(document.body)). Arm = virt x gc.
// Usage (repo root): PW_DIR=... CHROME=... [BARO_DIST=<dir with barocss.umd.cjs>] [N=2000] [INTERVAL=20] [UNIQUE=3]
//   node scripts/long-chat-431/run.mjs <virt:0|1> <gc:0|1>     -> merges the arm into result.json
import fs from 'node:fs'; import os from 'node:os'; import http from 'node:http'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, '../..');
const VIRT = process.argv[2] === '1', GC = process.argv[3] === '1';
const N = Number(process.env.N || 2000), INTERVAL = Number(process.env.INTERVAL ?? 20), UNIQUE = Number(process.env.UNIQUE ?? 3);
const KEEP = 50, PORT = Number(process.env.PORT || 8600);
const DIST = process.env.BARO_DIST || path.join(os.homedir(), '.barocss-ai/v3/integration/packages/barocss-browser/dist/cdn');
const UMD = fs.readFileSync(path.join(DIST, 'barocss.umd.cjs'));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
// Top-level blocks of each recorded body = the message pool.
const OUT = path.join(ROOT, 'scripts/mcp-model-outputs/outputs-tw'); const POOL = [];
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.html')).sort()) {
  const body = fs.readFileSync(path.join(OUT, f), 'utf8').match(/<body[^>]*>([\s\S]*)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/gi, '');
  const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g; let t, d = 0, s = 0;
  while ((t = re.exec(body))) {
    if (t[1]) { if (--d === 0) POOL.push(body.slice(s, re.lastIndex)); }
    else if (!t[3] && !VOID.test(t[2])) { if (d++ === 0) s = t.index; }
  }
}
const srv = http.createServer((q, r) => {
  if (q.url === '/baro.js') { r.setHeader('content-type', 'text/javascript'); return r.end(UMD); }
  r.setHeader('content-type', 'text/html');
  r.end(`<!doctype html><head><script src="/baro.js"></script></head><body><div id="list"></div><script>
  window.__rt = new BaroCSS.BrowserRuntime({ gc: ${GC} }); __rt.observe(document.body, { scan: true });</script></body>`);
}).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${PORT}/`);
const SAMPLE = `(() => { gc(); let rules = 0; const walk = (l) => { for (const r of l) { rules++; if (r.cssRules) walk(r.cssRules); } };
  for (const s of document.styleSheets) walk(s.cssRules); for (const s of document.adoptedStyleSheets) walk(s.cssRules);
  const st = __rt.getCacheStats().runtime; return { rules, styles: document.querySelectorAll('style').length,
  adopted: document.adoptedStyleSheets.length, domMsgs: document.getElementById('list').children.length,
  cachedClasses: st.cachedClasses, runtimeRuleCount: st.ruleCount, reclaimed: st.reclaimedClasses,
  heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) }; })()`;
const samples = []; let costMs = 0; const t0 = Date.now();
for (let i = 1; i <= N; i++) {
  const gen = [`mt-[${i}px]`, `text-[#${((i * 97) % 0xffffff).toString(16).padStart(6, '0')}]`, `w-[${i}.5rem]`];
  const html = `<div class="msg flex gap-3 p-4 ${gen.slice(0, UNIQUE).join(' ')}">${POOL[i % POOL.length]}</div>`;
  // cost = synchronous append + the runtime's mutation handling up to the next frame (wall, report-only)
  costMs += await page.evaluate(async ([h, virt, keep]) => {
    const t = performance.now(); const l = document.getElementById('list');
    l.insertAdjacentHTML('beforeend', h); if (virt) while (l.children.length > keep) l.firstElementChild.remove();
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); return performance.now() - t;
  }, [html, VIRT, KEEP]);
  if (INTERVAL) await new Promise((r) => setTimeout(r, INTERVAL));
  if (i % 100 === 0) {
    samples.push({ n: i, ...(await page.evaluate(SAMPLE)), costMsPerMsg: +(costMs / 100).toFixed(2), elapsedS: +((Date.now() - t0) / 1000).toFixed(1) });
    costMs = 0; process.stderr.write(`${i} `);
  }
}
await new Promise((r) => setTimeout(r, 8000)); // gcGraceMs default 3000; let a sweep settle
const settled = await page.evaluate(SAMPLE);
await browser.close(); srv.close();
const RES = path.join(HERE, 'result.json'); const all = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {};
all[`virt${+VIRT}_gc${+GC}`] = { N, INTERVAL, UNIQUE, KEEP, poolBlocks: POOL.length, loadavg: os.loadavg().map((x) => +x.toFixed(2)), samples, settledAfter8s: settled };
fs.writeFileSync(RES, JSON.stringify(all, null, 1));
console.log(JSON.stringify({ arm: `virt${+VIRT}_gc${+GC}`, last: samples.at(-1), settled }));
