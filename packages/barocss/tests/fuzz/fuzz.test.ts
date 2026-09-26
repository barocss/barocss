/**
 * #319 seeded fuzz smoke test (kit only, no browser). Generates a fixed set of class inputs from the
 * grammar / mutation / sweep / random generators in harness.mjs and checks the GENERIC output properties
 * P1 (structural parse), P2 (scope), P3 (injection shape) and P4 (size) on generateCss output.
 * P5 (#346, REPORT-ONLY): outputs carrying a resource-loading function (url( / image-set( ...) in a value.
 * Known-open counts are a ratchet: a count may go down (update BASELINE), never up.
 * Long campaign with Chromium CSSOM: scripts/fuzz/campaign.mjs.
 */
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { corpus } from '../compat/corpus';

// #346: resource-loading functions in output values (report-only, no baseline).
const RESOURCE_FN = /(?:^|[^\w-])(?:url|image-set|-webkit-image-set|image|src|cross-fade|element)\s*\(/i;
// @ts-expect-error plain ESM helper without types
import * as H from './harness.mjs';

// #392 multi-seed ratchet: a fixed seed list plus one rotating seed (FUZZ_SEED, else the CI run id, else the
// UTC date as YYYYMMDD). Every seed is logged, so a failure reproduces with FUZZ_SEED=<seed>.
const FIXED_SEEDS = [319, 1, 7777];
function rotatingSeed(): number {
  const env = typeof process !== 'undefined' ? process.env : {};
  const raw = env.FUZZ_SEED || env.GITHUB_RUN_ID || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : [...raw].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
}
const SEEDS = [...new Set([...FIXED_SEEDS, rotatingSeed()])];
const PER_GENERATOR = 5000;

// Open counts per property, for every seed in SEEDS at PER_GENERATOR (tracked in #319). Lower them when fixes land.
const BASELINE: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, throws: 0 };

function runCampaign(SEED: number) {
  const ctx = createContext({});
  const r = H.rng(SEED);
  const seeds = corpus.map(([t]) => t);
  const sweepOffset = SEED === FIXED_SEEDS[0] ? 0 : SEED % seeds.length; // each seed sweeps a different slice of the corpus
  const inputs: string[] = [];
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.genGrammar(r));
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.mutate(r, r.pick(seeds)));
  const sw: string[] = [];
  for (let k = 0; sw.length < PER_GENERATOR; k++) for (const s of H.sweep(seeds[(k + sweepOffset) % seeds.length])) sw.push(s);
  inputs.push(...sw.slice(0, PER_GENERATOR));
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.genRandom(r));
  // #339: bracket groups, lone/unbalanced brackets, chained arbitrary and relational variants.
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.genBrackets(r));

  const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, throws: 0 };
  for (const input of inputs) {
    let css: string;
    try { css = generateCss(input, ctx); } catch { counts.throws++; continue; }
    const props = new Set<string>(H.checkCss(css, input, H.classPredicate(input)).map((v: { prop: string }) => v.prop));
    for (const p of props) counts[p]++;
    if (RESOURCE_FN.test(css)) counts.P5++;
  }
  return { counts, n: inputs.length };
}

describe('#319 fuzz: class-input output properties (seeded)', () => {
  it.each(SEEDS)('stays within the known-open baseline per property (seed %i)', (seed) => {
    const { counts, n } = runCampaign(seed);
    expect(n).toBe(PER_GENERATOR * 5);
    console.log(`[#319 fuzz] seed ${seed} (rerun: FUZZ_SEED=${seed}): ${JSON.stringify(counts)} of ${n}; P5 is report-only`);
    for (const k of Object.keys(BASELINE)) expect.soft(counts[k], `${k} (seed ${seed})`).toBeLessThanOrEqual(BASELINE[k]);
    expect(counts.P2, `scope (seed ${seed})`).toBe(0);
    expect(counts.P4, 'size cap').toBe(0);
  }, 60_000);
});
