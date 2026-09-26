// #376 model generation: 6 requests x 4 formats x {opus, haiku} = 48 `claude -p` calls (run once; skips existing).
// Rerun: node scripts/json-render-376/gen.mjs   Output: raw/<fmt>--<model>--<req>.json (claude JSON incl. cost),
// outputs/<fmt>--<model>--<req>.txt (model text, fences stripped). `claude -p` runs outside the repo (no CLAUDE.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HERE, REQS, FORMATS, MODELS } from './lib.mjs';
import { buildPrompts } from './prompts.mjs';

const RAW = path.join(HERE, 'raw'), OUT = path.join(HERE, 'outputs');
fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const P = await buildPrompts();
fs.writeFileSync(path.join(HERE, 'prompts.json'), JSON.stringify(Object.fromEntries(FORMATS.map((f) => [f, { system: P[f].system, user: P[f].user('{REQUEST}') }])), null, 1));
const jobs = [];
for (const f of FORMATS) for (const m of MODELS) for (const [k, r] of Object.entries(REQS)) jobs.push({ f, m, k, r });
const env = { ...process.env }; delete env.CLAUDECODE;
function run(j) {
  const file = path.join(RAW, `${j.f}--${j.m}--${j.k}.json`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return Promise.resolve();
  return new Promise((res) => {
    const c = spawn('claude', ['-p', P[j.f].user(j.r), '--system-prompt', P[j.f].system, '--model', j.m, '--tools', '', '--output-format', 'json'],
      { cwd: '/private/tmp/claude-501', env, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', () => {});
    c.on('close', () => { fs.writeFileSync(file, o); res(); });
  });
}
const Q = [...jobs]; await Promise.all(Array.from({ length: 8 }, async () => { while (Q.length) await run(Q.shift()); }));
let cost = 0;
for (const j of jobs) {
  const b = `${j.f}--${j.m}--${j.k}`; let d = {};
  try { d = JSON.parse(fs.readFileSync(path.join(RAW, b + '.json'), 'utf8')); } catch {}
  cost += d.total_cost_usd || 0; let t = (d.result || '').trim();
  const m = t.match(/```[a-z]*\s*\n([\s\S]*?)```/); if (m) t = m[1].trim();
  fs.writeFileSync(path.join(OUT, b + '.txt'), t + '\n');
}
console.log('jobs', jobs.length, 'cost_usd', cost.toFixed(4));
