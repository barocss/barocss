# Kernel lane brief: K13, opening time (2026-10-24, after K12)

## Role

This is the same role as kernel.md and kernel-k12.md. You own `packages/barocss-cad/**` and commit directly on the
integration branch `review/cad-gpu-engine-2026-10-14`, in the worktree
`.claude/worktrees/barocss-cad-gpu-review-efbb2c`.
- Never amend, rebase or reset there. Check `git status` before committing, and never commit files you did not change.

## Read first

1. common.md.
2. decisions.md D240, the opening-time profile. Its harness runs the studio's open path in Node 22 on the GPU lane's
   G11 scene files.
3. D235–D239, for K12's state, and D212–D234, for where modules are since R5.
4. The roadmap's K13 row.

## State

- K12 is done. The fingerprint is `b6e18fab` (scripts/r5-fingerprint.mjs, 855 cases).
- Since checkpoint 2, the passing test names of each checkpoint's kernel suite are saved. Diff them at every
  checkpoint and report any name that disappeared.
- **Scratch-worktree setup:** use real node_modules folders with the @barocss links inside the scratch tree. Never
  symlink to integration's node_modules. That symlink made checkpoint runs resolve integration's live packages
  (D240's note).

## Queue (K13): pure speed, behaviour unchanged

The rule for every step: the fingerprint is byte-identical, RB has no NEW, and the results are the same. Report the
before and after time per scene from D240's harness, at least three runs each, median.

1. **Box test before `intersectSegments`** in the Boolean's intervals: test a probe piece's bounding box against each ring
   segment's box first. Target the 5 box frames, where 120 analytic Booleans take about 85 ms each and cutPair is
   35 %.
2. **The NURBS basis (`basisInto`).** It's the hottest single function in every scene, under tessellation and mass
   quadrature. Make it faster without changing a bit of its output:
   - no allocation per call;
   - no nested functions or closures in the loop (owner rule);
   - reused scratch arrays;
   - the same arithmetic order. If a faster form changes the last bit, keep the old order.
3. **Mass quadrature and tessellation on the spring and worm pair.** The spring takes 2.05 s in quadrature and 1.34 s
   in tessellation; the worm pair 1.37 s and 0.61 s. Profile first, then fix what's yours.
   - Anything that needs a studio or cad-model change goes to the coordinator as a proposal. One example is computing
     mass lazily when the inspector shows it.
4. **Stop after 3**, and report the scene times before and after.

The outer lane owns the other findings and isn't part of K13:
- A9's p2 BEARING_HOUSING_REFERENCE on the studio's placedBase path;
- checkWormPair's 0.51 s.

## Verification (tiered)

- **Per step:**
  - build:library, type-check and lint;
  - the touched modules' tests;
  - the fingerprint;
  - D240's harness times.
- **Per checkpoint (one or two steps):**
  - the kernel suite at concurrency 4 through the gate, with the name diff;
  - RB;
  - the cad-model and studio unit suites.

  No browser flow unless something studio-visible changes.
- Heavy runs go through barocss-lanes-guard's gate in the background. Kill only your own PIDs. Use Node 22.
- If you change a bracketed refusal message or the folder it's raised from, regenerate the docs refusal table with
  `node apps/library-docs/scripts/refusals.mjs`. K13 shouldn't do either.

## Report

To the coordinator, in English, per checkpoint:
- the SHA;
- what changed;
- the scene times before and after;
- the fingerprint, which should be unchanged;
- the suite counts and the name diff.
