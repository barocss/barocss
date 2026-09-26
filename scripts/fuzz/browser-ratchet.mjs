/**
 * #406 multi-seed ratchet for the BROWSER fuzz campaign (campaign.mjs: kit, server, HTML and browser-rule paths
 * checked as text AND in headless Chromium CSSOM, including P2-by-matching against a decoy DOM).
 *
 * Seeds: the kit ratchet's fixed list (319, 1, 7777) plus one rotating seed (FUZZ_SEED, else GITHUB_RUN_ID, else the
 * UTC date as YYYYMMDD), each run for a fixed input count, so counts are deterministic (no wall-clock gating).
 *   - P2 (text scope check and DOM matching) and P3 must be 0 on every seed.
 *   - P1 per path|why must stay <= BASELINE for the fixed seeds (the rotating seed is report-only for P1).
 *     The baseline is browser-rejected CSS (invalid selectors built from user-supplied variants/arbitrary values),
 *     classified in #406; lower it when fixes land.
 *   - P4 time is wall-clock and report-only here.
 *
 * Not in GitHub CI (no Chromium there). Run locally / in the integration checks after
 * `pnpm -C packages/barocss build && pnpm -C packages/barocss-server build`:
 *   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> node scripts/fuzz/browser-ratchet.mjs
 *   [--inputs 20000] [--update]   (a failure reproduces with FUZZ_SEED=<seed>)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const INPUTS = Number(args[args.indexOf('--inputs') + 1] || 0) || 20000;
const UPDATE = args.includes('--update');
const FIXED_SEEDS = [319, 1, 7777];
const raw = process.env.FUZZ_SEED || process.env.GITHUB_RUN_ID || new Date().toISOString().slice(0, 10).replace(/-/g, '');
const rotating = Number.isFinite(Number(raw)) ? Number(raw) >>> 0 : [...raw].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const SEEDS = [...new Set([...FIXED_SEEDS, rotating])];
const BASELINE_FILE = new URL('./browser-ratchet-baseline.json', import.meta.url);
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
if (baseline.inputs !== INPUTS && !UPDATE) console.log(`note: baseline was taken at --inputs ${baseline.inputs}; P1 is compared only at that count`);

const root = new URL('../../', import.meta.url).pathname;
let failed = false;
const next = { inputs: INPUTS, P1: {} };
for (const seed of SEEDS) {
  const run = spawnSync(process.execPath, ['--import', './scripts/fuzz/kit-dist-loader.mjs', 'scripts/fuzz/campaign.mjs', '--seed', String(seed), '--inputs', String(INPUTS)],
    { cwd: root, encoding: 'utf8', env: process.env, timeout: 600_000, maxBuffer: 64 << 20 });
  const out = run.stdout ?? '';
  const start = out.indexOf('{\n');
  if (run.status !== 0 || start < 0) { console.log(`seed ${seed}: campaign failed (status ${run.status}) ${(run.stderr ?? '').slice(-400)}`); failed = true; continue; }
  const res = JSON.parse(out.slice(start, out.lastIndexOf('}') + 1));
  const v = res.violations;
  const fixed = FIXED_SEEDS.includes(seed);
  const sum = (prop) => Object.entries(v).filter(([k]) => k.split('|')[1] === prop).reduce((a, [, n]) => a + n, 0);
  const p1 = Object.fromEntries(Object.entries(v).filter(([k]) => k.split('|')[1] === 'P1'));
  const errs = [];
  if (sum('P2')) errs.push(`P2=${sum('P2')}`);
  if (sum('P3')) errs.push(`P3=${sum('P3')}`);
  if (fixed) {
    next.P1[seed] = p1;
    if (baseline.inputs === INPUTS) {
      const base = baseline.P1[seed] ?? {};
      for (const [k, n] of Object.entries(p1)) if (n > (base[k] ?? 0)) errs.push(`${k} ${n} > baseline ${base[k] ?? 0}`);
    }
  }
  console.log(`seed ${seed}${fixed ? '' : ' (rotating, P1 report-only)'} (rerun: FUZZ_SEED=${seed}): ${res.total} inputs, P1=${sum('P1')} P2=${sum('P2')} P3=${sum('P3')} P4=${sum('P4')}${errs.length ? '  FAIL ' + errs.join('; ') : '  ok'}`);
  if (errs.length) failed = true;
}
if (UPDATE) { writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 1) + '\n'); console.log('baseline updated'); }
process.exit(failed && !UPDATE ? 1 : 0);
