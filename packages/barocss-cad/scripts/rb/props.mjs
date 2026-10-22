// The property runs (RB4): every property of scripts/rb/property.mjs over its generator, with a fixed seed by
// default (CI) or RB_PROPERTY_SEED=random (nightly), RB_PROPERTY_RUNS a property (default 200). Prints passes,
// refusals (skips), times and any failure's smallest counterexample; exits 1 on a failure that is not a known
// one (robustness/properties-todo.json). --record appends a
// row to robustness/properties.jsonl. Needs dist/ (build:library).
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { forAll, properties } from './property.mjs';

const pkg = resolve(import.meta.dirname, '../..'), cad = await import(pathToFileURL(join(pkg, 'dist/index.js')).href);
const seedEnv = process.env.RB_PROPERTY_SEED, seed = seedEnv === 'random' ? Math.floor(Math.random() * 2 ** 31) : Number(seedEnv ?? 20261018);
const runs = Number(process.env.RB_PROPERTY_RUNS ?? 200), only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const pct = (list, q) => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
// Known failures (robustness/properties-todo.json: [{ property, note }], matched by the name's start): a failure
// of one is TODO, not a failed run; all its runs passing is an IMPROVEMENT (drop its entry).
const todoFile = join(pkg, 'robustness/properties-todo.json'), todo = existsSync(todoFile) ? JSON.parse(readFileSync(todoFile, 'utf8')) : [];
const known = name => todo.find(t => name.startsWith(t.property));
const results = [];
for (const p of properties(cad)) {
  if (only.length && !only.some(o => p.name.includes(o))) continue;
  const r = forAll({ ...p, runs, seed }); results.push(r);
  r.mark = r.failed ? (known(r.name) ? 'TODO' : 'NEW') : (known(r.name) ? 'IMPROVEMENT' : undefined);
  console.log(`${r.failed ? (r.mark === 'TODO' ? 'TODO' : 'FAIL') : r.mark === 'IMPROVEMENT' ? 'IMPR' : 'ok  '} ${r.name}\n     ${r.passed} passed, ${r.skipped} refused of ${r.runs}; p50 ${pct(r.times, 0.5).toFixed(0)} ms, p95 ${pct(r.times, 0.95).toFixed(0)} ms`);
  if (r.failed) console.log(`     run ${r.failed.run}: ${JSON.stringify(r.failed.value)}\n     smallest counterexample ${JSON.stringify(r.failed.smallest)}\n     ${JSON.stringify(r.failed.why)}`);
}
console.log(`seed ${seed}, ${runs} runs a property`);
if (process.argv.includes('--record')) {
  let commit = 'unknown'; try { commit = execSync('git rev-parse --short HEAD', { cwd: pkg }).toString().trim(); } catch { /* not a checkout */ }
  appendFileSync(join(pkg, 'robustness/properties.jsonl'), JSON.stringify({ commit, date: new Date().toISOString().slice(0, 10), seed, runs, results: results.map(r => ({ name: r.name, runs: r.runs, passed: r.passed, skipped: r.skipped, failed: !!r.failed, mark: r.mark ?? null, p50: +pct(r.times, 0.5).toFixed(1), p95: +pct(r.times, 0.95).toFixed(1) })) }) + '\n');
}
process.exit(results.some(r => r.mark === 'NEW') ? 1 : 0);
