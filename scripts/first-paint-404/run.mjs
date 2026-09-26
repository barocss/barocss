// #404: same-session first-paint rerun of the #383 claim (twb vs BaroCSS), interleaved round-robin.
// Reuses the #198 harness (scripts/mcp-html-probe: server + probe, metric timeToFinalStyled, typical CSP).
// Usage (repo root, after `pnpm install`; bundles come from jsDelivr in memory, see shim.mjs):
//   PW_DIR=... CHROME=... PROBE_PORT=7850 TWB_DIR=/__mem__/twb BARO_UMD=/__mem__/baro.js \
//     node --import ./scripts/first-paint-404/shim.mjs scripts/first-paint-404/run.mjs [rounds=10]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { start, PORT, SECTIONS } from '../mcp-html-probe/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = Number(process.argv[2] || 10);
const ARMS = ['twb', 'baro'];
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');

const srv = await start();
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const once = async (arm, sec) => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/host?arm=${arm}&sec=${sec}&csp=typical`);
  const r = await page.waitForFunction(() => window.__r && window.__r[0], null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
  await page.close();
  return r?.timeToFinalStyled ?? null;
};
// Warm-up round, discarded.
for (const sec of SECTIONS) for (const arm of ARMS) await once(arm, sec);
// Round r: every section, arm order alternates each round so neither arm always goes first.
const raw = [];
for (let r = 0; r < ROUNDS; r++) for (const sec of SECTIONS) {
  const order = r % 2 ? [...ARMS].reverse() : ARMS;
  for (const arm of order) raw.push({ r, sec, arm, ms: await once(arm, sec) });
}
const version = browser.version();
await browser.close();
srv.close();

const stats = (a) => {
  const s = a.filter((x) => x != null).sort((x, y) => x - y);
  return { n: s.length, median: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1], missing: a.length - s.length };
};
// Per round, each arm's page-median over sections: one sample per round per arm.
const perRound = Object.fromEntries(ARMS.map((arm) => [arm, Array.from({ length: ROUNDS }, (_, r) =>
  stats(raw.filter((x) => x.arm === arm && x.r === r).map((x) => x.ms)).median)]));
const summary = Object.fromEntries(ARMS.map((arm) => [arm, {
  allPageLoads: stats(raw.filter((x) => x.arm === arm).map((x) => x.ms)),
  perRoundMedian: stats(perRound[arm]),
}]));
const round1 = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)));
const out = round1({
  issue: 404, date: new Date().toISOString().slice(0, 10), rounds: ROUNDS, sections: SECTIONS, warmupDiscarded: true,
  releases: { twb: `@tailwindcss/browser@${process.env.TWB_VERSION || '4.1.13'}`, baro: `@barocss/browser@${process.env.BARO_VERSION || '0.10.3'}` },
  engine: `Chromium ${version} (Playwright chromium-1223, headless)`, machine: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0].model}, ${os.cpus().length} cores`,
  metric: 'timeToFinalStyled (ms from navigation start until computed styles first equal the settled final state), typical CSP',
  summary, perRound, raw,
});
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ engine: out.engine, machine: out.machine, summary: out.summary }, null, 1));
