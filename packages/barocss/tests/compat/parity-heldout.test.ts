import { describe, expect, it } from 'vitest';
import { corpusHeldout as corpus } from './corpus-heldout';
import { coverageReport, runParity, tailwindVersionDiffs } from './parity-compare';

// #243: same comparator as parity-corpus.test.ts over the held-out corpus (corpus-heldout.ts).
// Parity of every held-out class with Tailwind 4.3.x (#304; full default theme), compared by *effective* value:
// var() resolved against each side's :root, @property initial values and the rule's own custom properties, so
// equivalent output written differently (BaroCSS --baro-* vars vs Tailwind --tw-* vars) counts as parity.
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/parity-heldout.test.ts
//
// prints the frequency-weighted coverage. KNOWN_FAILURES lists classes that don't match yet; remove an entry when
// its fix lands (the test fails if a listed class starts passing, so the list can't go stale).

const KNOWN_FAILURES: Record<string, string> = {
};

describe('Tailwind 4.3.x parity over the #243 held-out corpus', async () => {
  const results = await runParity(corpus);
  console.log(coverageReport('held-out parity coverage (Tailwind 4.3.x)', results));
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

});
