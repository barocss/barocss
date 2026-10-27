#!/usr/bin/env node
/**
 * Every Node flow here (`*-flow.mjs`), each with a fresh --output, after building @barocss/cad and @barocss/gpu (R6).
 *   node examples/gpu-scene/run-flows.mjs [--out <new-directory>] [--only <regex>] [--no-build]
 * In the workspace `@barocss/cad` resolves to CAD's TypeScript sources, which Node does not load: each flow runs with
 * the gpu tests' hook (packages/barocss-gpu/tests/cad-dist.mjs, CAD's built entry) through NODE_OPTIONS, so the child
 * processes some flows start get it too. Exits non-zero when any flow fails; each flow's output is in <out>/<flow>.log.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const here = import.meta.dirname, repo = resolve(here, '../..');
const args = process.argv.slice(2), option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = option('--out') ? resolve(option('--out')) : mkdtempSync(join(tmpdir(), 'gpu-scene-flows-'));
mkdirSync(out, { recursive: true });
const only = option('--only') ? new RegExp(option('--only')) : null;
const TIMEOUT_MS = 180_000;

if (!args.includes('--no-build')) for (const pkg of ['barocss-cad', 'barocss-gpu']) {
  const r = spawnSync('pnpm', ['-s', 'build:library'], { cwd: join(repo, 'packages', pkg), stdio: 'inherit' });
  if (r.status !== 0) { console.error(`build of ${pkg} failed`); process.exit(1); }
}
const hook = join(repo, 'packages/barocss-gpu/tests/cad-dist.mjs');
const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import ${hook}`].filter(Boolean).join(' ') };
const flows = readdirSync(here).filter(f => f.endsWith('-flow.mjs') && (!only || only.test(f))).sort();
const failed = [];
for (const f of flows) {
  const name = f.slice(0, -4), t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, f), '--output', join(out, name)], { cwd: repo, env, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 << 20 });
  writeFileSync(join(out, name + '.log'), (r.stdout ?? '') + (r.stderr ?? ''));
  const ok = r.status === 0;
  if (!ok) failed.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${ok ? '' : r.error ? ' — ' + r.error.message : ' — ' + ((r.stderr ?? '').split('\n').find(l => /Error|assert/.test(l)) ?? `exit ${r.status}`).trim().slice(0, 200)}`);
}
console.log(`${flows.length - failed.length}/${flows.length} flows pass; logs in ${out}`);
process.exit(failed.length ? 1 : 0);
