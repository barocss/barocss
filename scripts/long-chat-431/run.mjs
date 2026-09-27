// #431: long-running AI chat. Appends N messages (top-level blocks cut from the recorded #364 Tailwind-prompt
// outputs, scripts/mcp-model-outputs/outputs-tw, plus UNIQUE generated arbitrary-value classes per message) into a
// page running the prebuilt @barocss/browser UMD (new BrowserRuntime({ gc }) + observe(document.body)).
// Usage (repo root): PW_DIR=... CHROME=... [BARO_DIST=<dir with barocss.umd.cjs>] [N=2000] [INTERVAL=20] [UNIQUE=3]
//   node scripts/long-chat-431/run.mjs <virt:0|1> <gc:0|1|none> -> merges into RESULT_FILE
import fs from 'node:fs'; import os from 'node:os'; import http from 'node:http'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, '../..');
if (!['0', '1'].includes(process.argv[2]) || !['0', '1', 'none'].includes(process.argv[3])) {
  throw new Error('Usage: run.mjs <virt:0|1> <gc:0|1|none>');
}
const VIRT = process.argv[2] === '1', RUNTIME = process.argv[3] !== 'none', GC = process.argv[3] === '1';
const N = Number(process.env.N || 2000), INTERVAL = Number(process.env.INTERVAL ?? 20), UNIQUE = Number(process.env.UNIQUE ?? 3);
const KEEP = 50, PORT = Number(process.env.PORT || 8600);
const DIST = process.env.BARO_DIST || path.join(os.homedir(), '.barocss-ai/v3/integration/packages/barocss-browser/dist/cdn');
const UMD = RUNTIME ? fs.readFileSync(path.join(DIST, 'barocss.umd.cjs')) : null;
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
  r.end(`<!doctype html><head><script>
  window.__cssOps = { inserts: 0, deletes: 0 };
  for (const [method, field] of [['insertRule', 'inserts'], ['deleteRule', 'deletes']]) {
    const original = CSSStyleSheet.prototype[method];
    CSSStyleSheet.prototype[method] = function (...args) {
      const value = original.apply(this, args);
      window.__cssOps[field]++;
      return value;
    };
  }
  </script>${RUNTIME ? '<script src="/baro.js"></script>' : ''}</head><body><div id="list"></div>${RUNTIME ? `<script>
  window.__rt = new BaroCSS.BrowserRuntime({ gc: ${GC} }); __rt.observe(document.body, { scan: true });</script>` : ''}</body>`);
}).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${PORT}/`);
const SAMPLE = `(() => { gc(); let rules = 0, cssTextChars = 0; const walk = (l) => { for (const r of l) { rules++; cssTextChars += r.cssText.length; if (r.cssRules) walk(r.cssRules); } };
  for (const s of document.styleSheets) walk(s.cssRules); for (const s of document.adoptedStyleSheets) walk(s.cssRules);
  const st = window.__rt?.getCacheStats().runtime; const styles = [...document.querySelectorAll('style')];
  return { rules, cssTextChars, styles: styles.length, emptyStyles: styles.filter(s => !s.sheet?.cssRules.length).length,
  adopted: document.adoptedStyleSheets.length, domMsgs: document.getElementById('list').children.length,
  domElements: document.getElementById('list').getElementsByTagName('*').length,
  cachedClasses: st?.cachedClasses ?? null, runtimeRuleCount: st?.ruleCount ?? null, reclaimed: st?.reclaimedClasses ?? null,
  cssInserts: window.__cssOps.inserts, cssDeletes: window.__cssOps.deletes,
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
const RES = path.resolve(process.env.RESULT_FILE || path.join(HERE, 'result-post440.json'));
const all = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {};
const arm = `virt${+VIRT}_${RUNTIME ? `gc${+GC}` : 'noRuntime'}`;
all[arm] = { N, INTERVAL, UNIQUE, KEEP, poolBlocks: POOL.length, runtime: RUNTIME, gc: RUNTIME ? GC : null,
  loadavg: os.loadavg().map((x) => +x.toFixed(2)), samples, settledAfter8s: settled };
fs.writeFileSync(RES, JSON.stringify(all, null, 1));
console.log(JSON.stringify({ arm, last: samples.at(-1), settled }));
