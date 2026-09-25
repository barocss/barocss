// #198 runner. Usage (from the repo root, after `pnpm --filter @barocss/browser build:library`):
//   TWB_DIR=<dir of @tailwindcss/browser@4.1.13> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> \
//     [ARMS=ref,baro,baropf,twb,none] [CSPS=typical,strict] node scripts/mcp-html-probe/run.mjs [runs=5]
// Writes scripts/mcp-html-probe/result.json and prints a summary table.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { start, PORT, SECTIONS, FILES } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.argv[2] || 5);
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const ARMS = (process.env.ARMS || 'ref,baro,baropf,twb,none').split(',');
const CSPS = (process.env.CSPS || 'typical,strict').split(',');
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const srv = await start();
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const raw = [];
for (const csp of CSPS) for (const arm of ARMS) for (const sec of SECTIONS) for (let i = 0; i < RUNS; i++) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/host?arm=${arm}&sec=${sec}&csp=${csp}`);
  const r = await page.waitForFunction(() => window.__r && window.__r[0], null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
  raw.push({ csp, arm, sec, i, ...(r || { error: 'no report' }) });
  await page.close();
}
await browser.close();
srv.close();

// Parity: share of (element, property) cells equal to the built reference under the typical CSP.
const refSig = {};
for (const r of raw) if (r.csp === 'typical' && r.arm === 'ref' && r.i === 0) refSig[r.sec] = r.finalSig;
function parity(r) {
  const a = r.finalSig, b = refSig[r.sec];
  if (!a || !b || a.length !== b.length) return null;
  let same = 0, all = 0;
  a.forEach((row, i) => row.forEach((v, j) => { all++; if (v === b[i][j]) same++; }));
  return same / all;
}
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const bytes = { baro: [fs.statSync(FILES.baro).size, gz(FILES.baro)], baropf: [fs.statSync(FILES.baro).size, gz(FILES.baro)], twb: [fs.statSync(FILES.twb).size, gz(FILES.twb)], ref: null, none: null };
const twbDyn = raw.find((r) => r.arm === 'twb' && r.csp === 'typical' && r.dynamicMs != null)?.dynamicSig;
const summary = [];
for (const csp of CSPS) for (const arm of ARMS) {
  const rs = raw.filter((r) => r.csp === csp && r.arm === arm);
  const par = SECTIONS.map((s) => parity(rs.find((r) => r.sec === s && r.i === 0) || {}));
  summary.push({
    csp, arm,
    parity: par.every((p) => p != null) ? par.reduce((x, y) => x + y, 0) / par.length : null,
    paritySections: Object.fromEntries(SECTIONS.map((s, k) => [s, par[k]])),
    timeToFinalStyledMs: median(rs.map((r) => r.timeToFinalStyled)),
    dynamicStyled: rs.filter((r) => r.dynamicMs != null).length + '/' + rs.length,
    dynamicMs: median(rs.map((r) => r.dynamicMs)),
    dynamicMatchesTwb: twbDyn ? rs.filter((r) => JSON.stringify(r.dynamicSig) === JSON.stringify(twbDyn)).length + '/' + rs.length : null,
    violations: [...new Set(rs.flatMap((r) => r.violations || []))].slice(0, 6),
    errors: rs.filter((r) => r.error).length,
    bytes: bytes[arm],
    // First differing cells vs the built reference (section, element index, property, arm value, reference value).
    diffs: SECTIONS.flatMap((sec) => {
      const a = rs.find((r) => r.sec === sec && r.i === 0)?.finalSig, b = refSig[sec];
      if (!a || !b) return [];
      return a.flatMap((row, i) => row.map((v, j) => v === b[i][j] ? null : [sec, i, rs[0].props[j], v, b[i][j]]).filter(Boolean));
    }),
    dynamicSig: rs[0]?.dynamicSig,
  });
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ runs: RUNS, sections: SECTIONS, summary, raw: raw.map(({ finalSig, ...r }) => r) }, null, 1));
for (const s of summary) console.log([s.csp, s.arm, s.parity == null ? '-' : (s.parity * 100).toFixed(1) + '%', s.timeToFinalStyledMs == null ? '-' : Math.round(s.timeToFinalStyledMs) + 'ms',
  'dyn ' + s.dynamicStyled, s.dynamicMs == null ? '' : Math.round(s.dynamicMs) + 'ms', 'dyn=twb ' + s.dynamicMatchesTwb, s.bytes ? s.bytes.join('/') + 'B' : '', 'err ' + s.errors, s.violations.join(' | ')].join('  '));
