# D357 — Previews and lofts read parameter-bound sketches

Status: **BOUNDED_QUALIFIED**, the tenth bounded item of roadmap 09. It fixes the side note from the D356 audit. Source commit `9ba588d0c` (11 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md). Related: #551 (dependency recomputation; the Loft snapshot is stated, not changed) and #2250 (parameter consumers). Both stay open.

## Defect

`profiles.ts` read sketch sizes with `Number()`. A free sketch bound to a parameter (`max: [{parameter:'W'}, 40]`) therefore gave these results ([probe-before/repro.out.txt](probe-before/repro.out.txt)):

- `profileMiddle` returned `[null, 20]`. Extrude and Revolve handles were at NaN.
- `profileRings` returned NaN points, so the model view drew broken outlines.
- `loftSections` wrote section copies with `start: [null, null]`, which the kernel refused.

## Repair

- **Resolved sizes.** `profileRings`, `profileMiddle`, `loftSections` and `framedLoftSections` take the document parameters and resolve bound sizes with `resolveSketchDims`. The Extrude, offset-face, Revolve and edit-Revolve handles, the Loft command and Studio's free-sketch rings pass the parameters.
- **Refusal.** A missing or non-finite parameter refuses with the sketch named, for example "Sketch 2 uses parameter B, which this document does not have". Handles are then omitted, Loft is unavailable with that reason, and Studio draws no rings for that sketch. Studio catches only this refusal.
- **Snapshot.** Loft section copies are numbers at today's values. A Sizes step says "Copied at W = 60: later parameter changes do not update this loft.", and features.md says the same.
- **Behaviour change (audit F2).** The Bézier-guided path used to clone the sketch with its bindings: a changed radius failed loudly in the kernel. It is now a snapshot, like the other paths.
- **`loftTop`.** It refuses a bound sketch instead of writing NaN.

## Retained failures and corrections

1. No Studio baseline run. The Model reproduction is recorded.
2. Actual run01 failed in the driver: the oracle's `fr()` rejected a Fraction input. Steps 01–04 had passed.
3. Run02 passed on the pre-audit source.
4. The independent audit returned CHANGES_REQUIRED:
   - F1: the snapshot was silent.
   - F2: the guided-path change was not stated.
   - F3: mutants M7–M10 survived.
   - F4: the reasons showed the code prefix.

   All four are fixed, as are side notes S2 and S3. S1 (`loopOf` NaN) stays open.
5. Run03 passed its automated checks. Root image review then failed it: the new step label "Parameters" overlapped its text in the HUD. The label became "Sizes", and run04 qualifies.

## Verification

- **Model:** 16 new tests. Affected checks pass 155/155. Types and lint PASS. Mutants M1–M3 and M5–M15 are killed; M4 is equivalent.
- **Studio:** 36/36. Types PASS.
- **Docs:** check-docs, refusals and inventory PASS.
- **Actual [run-04](studio/run-04/receipt.json):** one Chrome, two contexts.
  1. Open the fixture (W = 60, two free bound rectangles). Both rings are finite.
  2. Extrude n0 by 10. The HUD shows a preview with a finite handle; volume 24000.
  3. Undo, then Loft both. The Sizes step appears. After Apply the volume is 49999.99999999998; the exact ruled-loft oracle gives 50000.
  4. Set W = 70. The loft does not follow, and no toast appears.
  5. Save, then fresh Open. The volume is the same.
  - 5/5 oracles PASS. Errors 0. All 985 frozen files equal the commit.
  - Root images: the Extrude handle sits at the profile middle, and the Loft steps are aligned.

## Boundaries

NOT_RUN: full suites, remote CI, release. Revolve is covered by Model tests only. Screenshots and page HTML are not committed (repo guard). The bundled `inspector.mjs` is omitted; it can be rebuilt from `inspector.ts`.
