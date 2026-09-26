/**
 * #319 seeded fuzz smoke test (kit only, no browser). Generates a fixed set of class inputs from the
 * grammar / mutation / sweep / random generators in harness.mjs and checks the GENERIC output properties
 * P1 (structural parse), P2 (scope), P3 (injection shape) and P4 (size) on generateCss output.
 * Known-open counts are a ratchet: a count may go down (update BASELINE), never up.
 * Long campaign with Chromium CSSOM: scripts/fuzz/campaign.mjs.
 */
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { corpus } from '../compat/corpus';
// @ts-expect-error plain ESM helper without types
import * as H from './harness.mjs';

const SEED = 319;
const PER_GENERATOR = 5000;

// Open counts per property for SEED/PER_GENERATOR (tracked in #319). Lower them when fixes land.
const BASELINE: Record<string, number> = { P1: 0, P2: 134, P3: 0, P4: 0, throws: 22 };

function runCampaign() {
  const ctx = createContext({});
  const r = H.rng(SEED);
  const seeds = corpus.map(([t]) => t);
  const inputs: string[] = [];
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.genGrammar(r));
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.mutate(r, r.pick(seeds)));
  const sw: string[] = [];
  for (let k = 0; sw.length < PER_GENERATOR; k++) for (const s of H.sweep(seeds[k % seeds.length])) sw.push(s);
  inputs.push(...sw.slice(0, PER_GENERATOR));
  for (let i = 0; i < PER_GENERATOR; i++) inputs.push(H.genRandom(r));

  const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, throws: 0 };
  for (const input of inputs) {
    let css: string;
    try { css = generateCss(input, ctx); } catch { counts.throws++; continue; }
    const props = new Set<string>(H.checkCss(css, input, H.classPredicate(input)).map((v: { prop: string }) => v.prop));
    for (const p of props) counts[p]++;
  }
  return { counts, n: inputs.length };
}

describe('#319 fuzz: class-input output properties (seeded)', () => {
  it('stays within the known-open baseline per property', () => {
    const { counts, n } = runCampaign();
    expect(n).toBe(PER_GENERATOR * 4);
    for (const k of Object.keys(BASELINE)) expect.soft(counts[k], k).toBeLessThanOrEqual(BASELINE[k]);
    expect(counts.P4, 'size cap').toBe(0);
  }, 30_000);
});
