# D355 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The auditor read the uncommitted fix on b37a3c5f7 and wrote nothing to it. Probes are in [../audit](../audit); `SELECT=select.base.ts` swaps in the base `select.ts` when bundling. Raw outputs were not saved; the numbers below are the auditor's reported observations.

**Verdict: PASS.**

## What the audit showed

- **Silent retarget on base.** [p4.ts](../audit/p4.ts) runs the real hook. A rectangle is drawn from its upper-right corner, with a fillet on `n1.side[e1]|n1.side[e4]`. After reopen→Finish with no change, base moves the fillet edge from (10,6) to (0,0) and the volume stays 298.9270, so nothing is reported. The current code keeps the edge.
- **Mapping matrix.** [p1.ts](../audit/p1.ts) covers 4 corners × 12 variants (hole, Bézier and construction before or after, rectangle hole, construction rectangle, region), each with 3 round trips. Current: 48/48 keep, with tags checked against segment endpoints. Base: 43/48 rename.
- **Downstream.** [p3.ts](../audit/p3.ts) runs the real hook with `evaluateDoc` and a fillet. Current: identical volume and face names. Base: "The selected edge no longer exists". A pre-R10a node gets its `renameToTagged` rewrite and evaluates.
- **Edits after reopen.** Width/height edits, D348 feature-editor fields and the Dimension tool all keep the tags. Round-corner and split keep the existing ids and add one (base renumbers everything).
- **Construction carry fixes a bug.** On base, a construction rectangle reopened under Select lost its flag and became real geometry (volume 62.8 → 237.2). Current keeps it as construction. Residual: its stored form changes once, from rectangle to polygon, and is stable afterwards.
- **Tests.**
  - New tests: Model 9/9 and Studio 5/5. On base, Model has 6 failures and Studio 1, all for the right reasons.
  - Regression sweeps: Model 151/151, Studio 15/15. Types and eslint pass.
  - Mutants: 8 of 8 killed.

## Low findings (tests)

- **T1.** The "upper-right corner" test does not reach the corner mapping, because reopen's `mainShape` always returns a = min. The direct `rectangleOutline` unit test is what kills the mapping mutants.
- **T2.** No end-to-end test covers the construction carry.

Both are retained as limits.

## Side notes (pre-existing, identical on base; not D355)

- **S1.** A circle main with a rectangle region swaps roles on reopen→Finish. Names and volume are unchanged, but the circle's editor fields disappear.
- **S2.** A slot's arc centre drifts from 0 to 3.33e-16.
- **S3.** A parameter-bound rectangle (`max:[{parameter:'w'},6]`) reopened→Finished writes null coordinates as a loop profile, with no notice. `mainShape` applies `Number()` to a Dim. This is a data-loss candidate for the next item.
