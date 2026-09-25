// #193 streaming class probe: BaroCSS UMD (baroStart) vs @tailwindcss/browser, in a sandboxed iframe under the typical
// MCP-Apps CSP (same host/CDN shape as scripts/mcp-html-probe/server.mjs), fed a frozen token stream (fixture.json).
// Rerun (from the repo root, after `pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library`):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> \
//     [RATES=30,100,300] [ARMS=baro,baropre,twb] [MODES=A,R,B,J] node scripts/stream-probe/run.mjs
// Refreeze the stream: node scripts/stream-probe/gen-fixture.mjs. Writes scripts/stream-probe/result.json (gitignored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PORT = Number(process.env.PROBE_PORT || 5400), CDN = `http://127.0.0.1:${PORT + 1}`;
const FIX = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture.json'), 'utf8'));
const STREAM = fs.readFileSync(path.join(HERE, 'stream.js'), 'utf8');
const BARO = path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
const TWB = path.join(process.env.TWB_DIR || '', 'dist/index.global.js');
const CSP = `default-src 'none'; script-src 'unsafe-inline' ${CDN}; style-src 'unsafe-inline' ${CDN}; img-src data: ${CDN}; font-src ${CDN}; connect-src ${CDN}`;
const RATES = (process.env.RATES || '30,100,300').split(',').map(Number);
const ARMS = (process.env.ARMS || 'baro,baropre,twb').split(',');
const MODES = (process.env.MODES || 'A,R,B,J').split(',');

const head = (arm) => arm === 'twb' ? `<script src="${CDN}/twb.js"></script>` : `<script src="${CDN}/baro.js"></script><script src="${CDN}/boot.js"></script>`;
const hostSrv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), q = u.search.slice(1), arm = u.searchParams.get('arm');
  if (u.pathname === '/host') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts" style="width:1280px;height:2400px;border:0" src="/res?${q}"></iframe><script>window.__r=[];addEventListener('message',e=>{if(e.data&&e.data.probe)window.__r.push(e.data)});</script>`); }
  if (u.pathname === '/res') { res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP }); return res.end(`<!doctype html><html><head><meta charset="utf-8">${head(arm)}</head><body><div id="root"></div><script src="${CDN}/stream.js?${q}"></script></body></html>`); }
  res.writeHead(404); res.end();
});
const cdnSrv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const js = (b) => { res.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }); res.end(b); };
  if (u.pathname === '/baro.js') return js(fs.readFileSync(BARO));
  if (u.pathname === '/boot.js') return js('BaroCSS.baroStart();');
  if (u.pathname === '/twb.js') return js(fs.readFileSync(TWB));
  if (u.pathname === '/stream.js') {
    const p = u.searchParams, arm = p.get('arm');
    return js(`window.__CFG=${JSON.stringify({ arm, mode: p.get('mode'), rate: Number(p.get('rate')), preload: arm === 'baropre', chunks: FIX.chunks })};\n${STREAM}`);
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => hostSrv.listen(PORT, '127.0.0.1', r));
await new Promise((r) => cdnSrv.listen(PORT + 1, '127.0.0.1', r));

const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function run(arm, mode, rate) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/host?arm=${arm}&mode=${mode}&rate=${rate}`);
  const timeout = 10000 + (FIX.tokens / rate) * 1000 * 1.5;
  const r = await page.waitForFunction(() => window.__r[0], null, { timeout, polling: 250 }).then((h) => h.jsonValue()).catch((e) => ({ error: String(e).slice(0, 200) }));
  await page.close();
  return r;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const out = [];
for (const arm of ARMS) {
  const one = await run(arm, 'O', 100); // one-shot reference: final HTML rendered once, same arm
  const oneSel = new Set(one.selectors || []);
  out.push({ arm, mode: 'O', rate: '-', rules: one.rules, bytes: one.bytes, error: one.error });
  for (const mode of MODES) for (const rate of RATES) {
    if (arm === 'baropre' && (mode === 'A' || mode === 'R')) continue; // preload needs the class list before mount: not available in modes A/R
    const r = await run(arm, mode, rate);
    if (r.error) { out.push({ arm, mode, rate, error: r.error }); continue; }
    const extra = r.selectors.filter((s) => !oneSel.has(s)), missing = [...oneSel].filter((s) => !r.selectors.includes(s));
    const cells = r.finalSig.length === one.finalSig.length ? r.finalSig.filter((s, k) => s === one.finalSig[k]).length / r.finalSig.length : null;
    const row = {
      arm, mode, rate, elements: r.elements, medianMs: median(r.latencies), p95Ms: pct(r.latencies, 0.95), maxMs: Math.max(...r.latencies), neverStyled: r.never,
      unstyledElementFrames: r.unstyledElementFrames, framesWithUnstyled: r.framesWithUnstyled, frames: r.frames,
      partialTokens: r.partialTokens.length, partialTokensWithRules: r.partialTokensWithRules,
      extraRulesVsOneShot: extra.length, extraExamples: extra.slice(0, 8), missingVsOneShot: missing.length,
      rules: r.rules, bytes: r.bytes, oneShotRules: one.rules, oneShotBytes: one.bytes, churn: r.churn,
      parity: cells, classesMatch: r.classesMatch,
    };
    out.push(row);
    console.log([arm, mode, rate, `med ${row.medianMs?.toFixed(1)}ms p95 ${row.p95Ms?.toFixed(1)}`, `unst ${row.unstyledElementFrames}/${row.framesWithUnstyled}fr`,
      `partial ${row.partialTokens} withRules ${row.partialTokensWithRules.length} [${row.partialTokensWithRules.slice(0, 6).join(" ")}]`, `extra ${row.extraRulesVsOneShot} [${row.extraExamples.slice(0, 4).join(" ")}]`, `css ${row.bytes}B/${row.rules}r vs ${one.bytes}B/${one.rules}r`,
      `churn +${r.churn.added}/-${r.churn.removed}`, `parity ${cells}`].join('  '));
  }
}
await browser.close(); hostSrv.close(); cdnSrv.close();
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ fixture: FIX.source, tokens: FIX.tokens, rows: out }, null, 1));
