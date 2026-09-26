// #415: replay recorded generative-UI HTML (the #364 Tailwind-prompt outputs, scripts/mcp-model-outputs/outputs-tw)
// token by token into a page running the local @barocss/browser build (default baroBoot observe config), vs a
// settled insert. One Chromium session; conditions interleaved round-robin with CONC concurrent pages.
// Usage (repo root, after `pnpm install` and `pnpm --filter @barocss/kit --filter @barocss/browser build:library`):
//   PW_DIR=... CHROME=... node scripts/stream-415/run.mjs [rounds=2] [conc=10]
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ROUNDS = Number(process.argv[2] ?? 2);
const CONC = Number(process.argv[3] || 10);
const PORT = Number(process.env.PORT || 8150);
const CHARS_PER_TOKEN = 4;
const GC_WAIT_MS = 7000; // gcGraceMs default 3000; a sweep can re-arm once
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');

const UMD = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const OUT_DIR = path.join(ROOT, 'scripts/mcp-model-outputs/outputs-tw');
const DOCS = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.html')).sort().map((f) => {
  const src = fs.readFileSync(path.join(OUT_DIR, f), 'utf8');
  const m = src.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  const bodyCls = (m[1].match(/class="([^"]*)"/) || [])[1] || '';
  // The model's <body> becomes a wrapper div (chat UIs render the reply inside a message node); scripts dropped.
  const html = `<div class="${bodyCls}">${m[2].replace(/<script[\s\S]*?<\/script>/gi, '')}</div>`.trim();
  return { id: f.replace('.html', ''), html };
});
// innerHTML: re-render the whole growing string per token (common chat-UI pattern).
// incremental: append-only; complete markup up to the last '>' is merged into the live DOM (existing nodes are
// kept, new nodes appended, a class attribute appears only once its tag has closed), like insertAdjacentHTML-
// based streaming renderers.
const CONDS = [
  { id: 'settled', mode: 'settled', rate: 0 },
  ...(process.env.RATES || "20,50,100").split(",").map(Number).flatMap((rate) => [{ id: `innerHTML@${rate}`, mode: 'innerHTML', rate }, { id: `incremental@${rate}`, mode: 'incremental', rate }]),
];

const srv = http.createServer((req, res) => {
  if (req.url === '/baro.js') { res.setHeader('content-type', 'text/javascript'); return res.end(UMD); }
  res.setHeader('content-type', 'text/html');
  res.end(req.url.startsWith('/bare') ? '<!doctype html><body><div id="msg"></div></body>'
    : '<!doctype html><head><script src="/baro.js"></script><script>BaroCSS.baroBoot();</script></head><body><div id="msg"></div></body>');
}).listen(PORT, '127.0.0.1');

const PROPS = ['color', 'background-color', 'padding-top', 'padding-left', 'margin-top', 'margin-bottom', 'font-size',
  'font-weight', 'width', 'max-width', 'border-top-width', 'border-top-left-radius', 'display', 'row-gap', 'opacity', 'box-shadow'];
const SNAP = `window.__snap = (props) => Array.from(document.querySelectorAll('#msg *')).map((el) => {
  const cs = getComputedStyle(el); return { tag: el.tagName, v: props.map((p) => cs.getPropertyValue(p)) }; });`;

const browser = await chromium.launch({ executablePath: process.env.CHROME });

// Per doc: unstyled reference (no runtime) and final styled reference (runtime, settled).
const REF = {};
for (const d of DOCS) {
  const p = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/bare`); await p.addScriptTag({ content: SNAP });
  const unstyled = await p.evaluate(([h, pr]) => { document.getElementById('msg').innerHTML = h; return __snap(pr); }, [d.html, PROPS]);
  await p.goto(`http://127.0.0.1:${PORT}/rt`); await p.addScriptTag({ content: SNAP });
  const final = await p.evaluate(async ([h, pr]) => { document.getElementById('msg').innerHTML = h;
    await new Promise((r) => setTimeout(r, 500)); return __snap(pr); }, [d.html, PROPS]);
  const finalClasses = await p.evaluate(() => [...new Set(Array.from(document.querySelectorAll('#msg *')).flatMap((e) => [...e.classList]))]);
  REF[d.id] = { unstyled, final, finalClasses };
  await p.close();
}

async function trial(cond, doc) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/rt`); await page.addScriptTag({ content: SNAP });
  const r = await page.evaluate(async ({ cond, html, ref, props, cpt, gcWait }) => {
    const rt = BaroCSS.getRuntime();
    const generated = new Set(); let calls = 0;
    const orig = rt.applyParseResults.bind(rt);
    rt.applyParseResults = (results, o) => { if (results.length) { calls++; results.forEach((x) => generated.add(x.cls)); } return orig(results, o); };
    const msg = document.getElementById('msg');
    const nextFrame = () => new Promise((res) => requestAnimationFrame(() => res()));
    const eq = (a, b) => a.every((v, i) => v === b[i]);
    // Visible wrong intermediate style: an element (same index and tag as in the final DOM) whose computed value
    // for a sampled property is neither its unstyled value nor its final value. Sampled every animation frame.
    let wrongSamples = 0, elemSamples = 0, frames = 0; const wrongEls = new Set(); const wrongProps = {};
    let streaming = true;
    const sampler = (async () => {
      while (streaming) {
        await nextFrame(); frames++;
        __snap(props).forEach((e, i) => {
          const f = ref.final[i], u = ref.unstyled[i];
          if (!f || f.tag !== e.tag) return; elemSamples++;
          let bad = false;
          e.v.forEach((v, k) => { if (v !== f.v[k] && v !== u.v[k]) { bad = true; wrongProps[props[k]] = (wrongProps[props[k]] || 0) + 1; } });
          if (bad) { wrongSamples++; wrongEls.add(i); }
        });
      }
    })();
    const sync = (dst, src) => { const dn = dst.childNodes, sn = src.childNodes;
      for (let k = 0; k < sn.length; k++) {
        const a = dn[k], b = sn[k];
        if (!a) { dst.appendChild(b.cloneNode(true)); continue; }
        if (a.nodeType === 1 && b.nodeType === 1 && a.tagName === b.tagName) {
          const bc = b.getAttribute('class');
          if (a.getAttribute('class') !== bc) { if (bc == null) a.removeAttribute('class'); else a.setAttribute('class', bc); }
          sync(a, b);
        } else if (a.nodeType === 3 && b.nodeType === 3) { if (a.data !== b.data) a.data = b.data; }
        else dst.replaceChild(b.cloneNode(true), a);
      } };
    const t0 = performance.now();
    if (cond.mode === 'settled') msg.innerHTML = html;
    else {
      const toks = []; for (let i = 0; i < html.length; i += cpt) toks.push(html.slice(i, i + cpt));
      const dt = 1000 / cond.rate; let acc = ''; let flushed = 0;
      for (let i = 0; i < toks.length; i++) {
        const wait = t0 + (i + 1) * dt - performance.now(); if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        acc += toks[i];
        if (cond.mode === 'innerHTML') msg.innerHTML = acc;
        else {
          const last = i === toks.length - 1; const cut = last ? acc.length : acc.lastIndexOf('>') + 1;
          if (cut > flushed) { const tpl = document.createElement('template'); tpl.innerHTML = acc.slice(0, cut); sync(msg, tpl.content); flushed = cut; }
        }
      }
    }
    const tLast = performance.now();
    let settleMs = null;
    for (let k = 0; k < 600; k++) { const s = __snap(props);
      if (s.length === ref.final.length && s.every((e, i) => eq(e.v, ref.final[i].v))) { settleMs = performance.now() - tLast; break; }
      await nextFrame(); }
    streaming = false; await sampler;
    const fin = new Set(ref.finalClasses);
    const stats = () => { const c = rt.getCacheStats().runtime; return { cachedClasses: c.cachedClasses, ruleCount: c.ruleCount, reclaimed: c.reclaimedClasses }; };
    const atEnd = stats();
    const cachedJunkEnd = rt.getClasses().filter((c) => !fin.has(c)).length;
    await new Promise((res) => setTimeout(res, gcWait));
    const afterGc = stats();
    const cachedJunkAfterGc = rt.getClasses().filter((c) => !fin.has(c)).length;
    const junk = [...generated].filter((c) => !fin.has(c));
    return { streamMs: tLast - t0, calls, generated: generated.size, junk: junk.length, junkSample: junk.slice(0, 8),
      frames, elemSamples, wrongSamples, wrongEls: wrongEls.size, wrongProps, settleMs, atEnd, cachedJunkEnd, afterGc, cachedJunkAfterGc };
  }, { cond, html: doc.html, ref: REF[doc.id], props: PROPS, cpt: CHARS_PER_TOKEN, gcWait: GC_WAIT_MS });
  await page.close();
  return { cond: cond.id, doc: doc.id, ...r };
}

// Warm-up (discarded), then ROUNDS x docs x conds, interleaved (order reversed on odd rounds); CONC pages at once.
await trial(CONDS[0], DOCS[0]); await trial(CONDS[CONDS.length - 1], DOCS[0]);
const jobs = [];
for (let r = 0; r < ROUNDS; r++) for (const d of DOCS) for (const c of (r % 2 ? [...CONDS].reverse() : CONDS)) jobs.push([c, d, r]);
const raw = []; let next = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (next < jobs.length) { const [c, d, r] = jobs[next++];
  const t = await trial(c, d); raw.push({ round: r, ...t }); process.stderr.write('.'); } }));
const version = browser.version();
await browser.close(); srv.close();

const q = (a, f) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : null; };
const med = (a) => q(a, 0.5);
const summary = Object.fromEntries(CONDS.map((c) => { const xs = raw.filter((x) => x.cond === c.id); return [c.id, {
  n: xs.length, junkRules: med(xs.map((x) => x.junk)), junkMax: Math.max(...xs.map((x) => x.junk)), calls: med(xs.map((x) => x.calls)),
  generated: med(xs.map((x) => x.generated)),
  wrongStyleSamplePct: med(xs.map((x) => (x.elemSamples ? (100 * x.wrongSamples) / x.elemSamples : 0))),
  streamsWithWrongStyle: xs.filter((x) => x.wrongSamples > 0).length, wrongEls: med(xs.map((x) => x.wrongEls)),
  lastTokenToFinalMs: med(xs.map((x) => x.settleMs)), lastTokenToFinalP90: q(xs.map((x) => x.settleMs), 0.9), unsettled: xs.filter((x) => x.settleMs == null).length,
  cacheEnd: med(xs.map((x) => x.atEnd.cachedClasses)), cachedJunkEnd: med(xs.map((x) => x.cachedJunkEnd)),
  cacheAfterGc: med(xs.map((x) => x.afterGc.cachedClasses)), cachedJunkAfterGc: med(xs.map((x) => x.cachedJunkAfterGc)),
  streamS: med(xs.map((x) => x.streamMs / 1000)),
}]; }));
const round1 = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)));
const out = round1({ issue: 415, date: new Date().toISOString().slice(0, 10), rounds: ROUNDS, docs: DOCS.map((d) => d.id), concurrency: CONC,
  charsPerToken: CHARS_PER_TOKEN, gcWaitMs: GC_WAIT_MS, props: PROPS,
  engine: `Chromium ${version} (Playwright chromium-1223, headless)`, machine: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0].model}, ${os.cpus().length} cores`,
  runtime: 'local packages/barocss-browser dist (baroBoot default config: observe body, gc on, gcGraceMs 3000)',
  summary, raw });
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
console.log('\n' + JSON.stringify(out.summary).replace(/\},"/g, '},\n"'));
