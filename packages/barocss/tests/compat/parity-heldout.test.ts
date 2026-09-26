import { describe, expect, it } from 'vitest';
import { corpusHeldout as corpus } from './corpus-heldout';
import { coverageReport, runParity } from './parity-compare';

// #243: same comparator as parity-corpus.test.ts over the held-out corpus (corpus-heldout.ts).
// Parity of every held-out class with Tailwind 4.1.13 (full default theme), compared by *effective* value:
// var() resolved against each side's :root, @property initial values and the rule's own custom properties, so
// equivalent output written differently (BaroCSS --baro-* vars vs Tailwind --tw-* vars) counts as parity.
//
//   pnpm --filter @barocss/kit exec vitest run tests/compat/parity-heldout.test.ts
//
// prints the frequency-weighted coverage. KNOWN_FAILURES lists classes that don't match yet; remove an entry when
// its fix lands (the test fails if a listed class starts passing, so the list can't go stale).

const KNOWN_FAILURES: Record<string, string> = {
  "text-[0.8rem]": "wrong formula: arbitrary length routed to color instead of font-size",
  "ease-in-out": "undefined var: var(--ease-in-out) not in BaroCSS theme vars",
  "max-w-max": "other: max-w-max/min/fit keyword missing",
  "has-focus:ring-[3px]": "missing variant: has-<pseudo> (has-focus)",
  "in-data-[side=left]:cursor-w-resize": "missing variant: in-* (in-data-[...])",
  "in-data-[side=right]:cursor-e-resize": "missing variant: in-* (in-data-[...])",
  "[--cell-size:--spacing(8)]": "other: arbitrary property with --spacing() function unsupported",
};

describe('Tailwind 4.1.13 parity over the #243 held-out corpus', async () => {
  const results = await runParity(corpus);
  console.log(coverageReport('held-out parity coverage', results));

  it('every class outside KNOWN_FAILURES matches Tailwind', () => {
    const unexpected = results.filter((r) => !r.pass && !(r.token in KNOWN_FAILURES));
    expect(unexpected.map((r) => `${r.token} (${r.uses}, ${r.family}): ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('every KNOWN_FAILURES entry still fails (remove it once fixed)', () => {
    const fixed = results.filter((r) => r.pass && r.token in KNOWN_FAILURES).map((r) => r.token);
    expect(fixed).toEqual([]);
  });

});
