import { describe, expect, it } from 'vitest';
import { corpus } from './corpus';
import { coverageReport, runParity, tailwindVersionDiffs } from './parity-compare';

// Parity of every #179 corpus class with Tailwind 4.3.x (#304; full default theme), compared by *effective* value
// (see parity-compare.ts): var() resolved against each side's :root, @property initial values and the rule's own
// custom properties, so equivalent output written differently (--baro-* vs --tw-* vars) counts as parity.
// #245: classes that only set custom properties (ring colours, from-*, …) are judged by the effective value they
// produce next to their composition partner, instead of passing or failing vacuously.
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/parity-corpus.test.ts
//
// prints the frequency-weighted coverage. KNOWN_FAILURES lists classes that don't match yet; remove an entry when
// its fix lands (the test fails if a listed class starts passing, so the list can't go stale).

const KNOWN_FAILURES: Record<string, string> = {};

describe('Tailwind 4.3.x parity over the #179 corpus', async () => {
  const results = await runParity(corpus);
  console.log(coverageReport('parity coverage (Tailwind 4.3.x)', results));
  // #304: report-only comparison against the previous reference, plus every class whose Tailwind output changed.
  const legacy = await runParity(corpus, 'tailwindcss-4-1');
  console.log(coverageReport('4.1.13 comparison', legacy).split('\n')[0]);
  const changed = await tailwindVersionDiffs(corpus.map(([t]) => t));
  console.log(`Tailwind 4.1.13 → 4.3.x output changes (${changed.length}):${changed.map((l) => `\n  ${l}`).join('')}`);

  it('every class outside KNOWN_FAILURES matches Tailwind', () => {
    const unexpected = results.filter((r) => !r.pass && !(r.token in KNOWN_FAILURES));
    expect(unexpected.map((r) => `${r.token} (${r.uses}, ${r.family}): ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('every KNOWN_FAILURES entry still fails (remove it once fixed)', () => {
    const fixed = results.filter((r) => r.pass && r.token in KNOWN_FAILURES).map((r) => r.token);
    expect(fixed).toEqual([]);
  });

  it('fixed families stay fixed: ring composition, leading-*, bare shadow', () => {
    const guarded = results.filter((r) => ['ring-1', 'ring-2', 'shadow'].includes(r.token) || r.family === 'leading');
    expect(guarded.length).toBeGreaterThan(3);
    expect(guarded.filter((r) => !r.pass).map((r) => r.token)).toEqual([]);
  });
});
