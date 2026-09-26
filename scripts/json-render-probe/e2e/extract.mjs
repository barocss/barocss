// #231: extract frozen specs from raw `claude -p` JSON. Rerun: node scripts/json-render-probe/e2e/extract.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const meta = { generated: '2026-09-26', harness: 'claude -p --tools "" --output-format json (generate.sh)', runs: {} };
let cost = 0;
for (const f of fs.readdirSync(path.join(HERE, 'raw')).filter((f) => f.endsWith('.json')).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(HERE, 'raw', f), 'utf8'));
  const txt = r.result || '';
  const m = txt.match(/\{[\s\S]*\}/);
  let ok = true;
  try { fs.writeFileSync(path.join(HERE, 'specs', f), JSON.stringify(JSON.parse(m[0]), null, 1)); } catch { ok = false; }
  cost += r.total_cost_usd || 0;
  meta.runs[f.replace('.json', '')] = { model: Object.keys(r.modelUsage || {}).join(','), costUsd: r.total_cost_usd, parsed: ok };
}
meta.totalCostUsd = +cost.toFixed(4);
fs.writeFileSync(path.join(HERE, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));
