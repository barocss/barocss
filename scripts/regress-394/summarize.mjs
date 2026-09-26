// #394: fold .out/ssr-r<k>-<v>.json (one per round and version) into per-version medians and spreads.
// Usage: node scripts/regress-394/summarize.mjs [versions...]  -> prints a table, writes .out/summary.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.out');
const vers = process.argv.slice(2);
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const sum = (a) => ({ n: a.length, median: +med(a).toFixed(2), min: +Math.min(...a).toFixed(2), max: +Math.max(...a).toFixed(2) });
const res = {};
for (const v of vers) {
  const files = fs.readdirSync(OUT).filter((f) => new RegExp(`^ssr-r\\d+-${v.replace(/\./g, '\\.')}\\.json$`).test(f));
  const acc = {};
  const push = (k, x) => { if (x != null) (acc[k] ??= []).push(x); };
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    for (const r of d.rows) if (r.arm === 'client-end' || r.arm === 'client-head') push(`hydrateMs.${r.arm}.${r.m}`, r.hydrateMs);
    for (const m of Object.keys(d.serverMs)) { push(`serverCold.${m}`, d.serverMs[m].serverCold); push(`serverWarm.${m}`, d.serverMs[m].serverWarm); }
  }
  res[v] = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, sum(a)]));
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(res, null, 1));
const keys = ['hydrateMs.client-end.opus', 'hydrateMs.client-end.haiku', 'hydrateMs.client-head.opus', 'hydrateMs.client-head.haiku', 'serverCold.opus', 'serverCold.haiku', 'serverWarm.opus'];
console.log('version ' + keys.map((k) => k.replace('hydrateMs.', '').padStart(20)).join(''));
for (const v of vers) console.log(v.padEnd(8) + keys.map((k) => { const s = res[v][k]; return s ? `${s.median} [${s.min}-${s.max}]`.padStart(20) : '-'.padStart(20); }).join(''));
