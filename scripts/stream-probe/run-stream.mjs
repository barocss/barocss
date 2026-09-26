// #290 streamed-SSR probe: Next.js App Router (16.3, React 19.2, Tailwind 4) page whose shell flushes first, then 3
// Suspense boundaries resolving 2 of #253's frozen opus blocks each at 300 / 550 / 800 ms.
// Rerun (repo root, after build:library of packages/barocss, barocss-browser, barocss-server):
//   mkdir -p $T && cd $T && npx create-next-app@latest nx --ts --tailwind --app --no-eslint --no-src-dir --use-npm --yes
//   (cd packages/<p> && pnpm pack --pack-destination $T/pkgs) for barocss, barocss-server, barocss-browser
//   cd $T/nx && npm i ../pkgs/*.tgz server-only && rm app/page.tsx && node <repo>/scripts/stream-probe/make-next.mjs .
//   npx next build && npx next start -p 6901
//   PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> [URL=http://localhost:6901] node scripts/stream-probe/run-stream.mjs [runs=3]
// Arms (route /s/<arm>): client (#242 runtime observing body, script right after the shell)
//   | shell-client (server sheet for the shell via useServerInsertedHTML, + client) | sih (per-chunk sheet through
//   useServerInsertedHTML) | prec (per-chunk React 19 <style href precedence>) | sih-client / prec-client (+ runtime)
//   | ref (no streaming: every chunk inline with one generateCssForHtml sheet; the reference signature).
// Per-chunk sheet = generateCssForHtml(chunk html, { skip: build CSS + the sheets already sent in this response }),
// tracked per request with React cache(). Chunk 0 has an lg:px-8 element alone; chunk 2 has sm:px-7 lg:px-8 on one
// element (order trap: its sheet then carries sm:px-7 after chunk 0's lg:px-8). CPU 4x via CDP, viewport 1280.
// Metrics: unstyled ms = first frame the chunk is visible -> first frame its 15-prop signature equals ref (max over
// chunks, median over runs); dups = class rules repeated across <style> sheets; final = share of chunk elements equal to ref.
// SUMMARY (2026-09-26): see results.md (per-chunk sheets break sm/lg order unless late sheets are adopted).
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(path.join(process.env.PW_DIR, 'node_modules/'));
const { chromium } = req('playwright-core');
const URL = process.env.URL || 'http://localhost:6901';
const RUNS = +(process.argv[2] || 3);
const ARMS = ['ref', 'client', 'shell-client', 'sih', 'prec', 'sih-client', 'prec-client', 'sih-full', 'prec-full', 'sih-adopt', 'prec-adopt'];
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function once(arm) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${URL}/s/${arm}?r=${Math.random()}`);
  await page.waitForFunction(() => window.__r, null, { timeout: 30000, polling: 200 });
  const r = await page.evaluate(() => window.__r);
  await ctx.close();
  return r;
}
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const ref = await once('ref');
const refSig = Object.fromEntries(Object.entries(ref.chunks).map(([i, f]) => [i, f[f.length - 1].sig]));
const eq = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
const rows = [];
for (const arm of ARMS.slice(1)) {
  const runs = [];
  for (let n = 0; n < RUNS; n++) {
    const r = await once(arm);
    let worst = 0, never = 0, same = 0, tot = 0; const per = {};
    for (const [i, fr] of Object.entries(r.chunks)) {
      const hit = fr.find((f) => eq(f.sig, refSig[i]));
      const u = hit ? hit.t - fr[0].t : null; per[i] = u == null ? 'never' : Math.round(u);
      if (u == null) never++; else worst = Math.max(worst, u);
      const last = fr[fr.length - 1].sig; tot += last.length; same += last.filter((s, k) => s === refSig[i][k]).length;
    }
    runs.push({ worst, never, per, dups: r.dups, final: same / tot, sheets: r.sheets });
  }
  rows.push({ arm, unstyledMs: Math.round(med(runs.map((x) => x.worst))), neverStyled: med(runs.map((x) => x.never)), per: runs[0].per,
    dups: med(runs.map((x) => x.dups)), final: +med(runs.map((x) => x.final)).toFixed(3), sheets: runs[0].sheets });
}
await browser.close();
console.log('arm           unstyled(max ms) perChunk            dups  final  ssrSheets(inHead/adopted/rules)');
for (const r of rows) console.log(r.arm.padEnd(13), String(r.unstyledMs).padEnd(16), JSON.stringify(r.per).padEnd(20), String(r.dups).padEnd(5), String(r.final).padEnd(6),
  r.sheets.map((s) => `${+s.inHead}/${+s.adopted}/${s.rules}`).join(' '));
