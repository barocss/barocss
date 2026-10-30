# D358 — A reopened sketch keeps its main circle

Status: **BOUNDED_QUALIFIED**, the eleventh bounded item of roadmap 09. It is side note S1 of the D355 audit. Source commit `2ad782f0e` (12 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md). Related: #551 (editable feature tree; stays open).

## Defect

Take a sketch whose main profile is a circle, with a rectangle region beside it. On reopen, the Select tool edits the rectangle and moves the circle aside. Finish then stored the rectangle as the main profile and the circle as a one-arc region ([probe-before/repro.out.txt](probe-before/repro.out.txt)). As a result:

- the Extrude editor lost the circle's Diameter and Centre fields;
- a radius bound to a parameter was dropped, with the "Bindings became numbers" toast.

The audit found the same swap on four more paths: Split/Trim/Extend, Offset, a tool switch without drawing, and a click on the circle itself. The click also renumbered the circle's side id (`e1` → `e6`), so a fillet on its edge failed with "The selected edge no longer exists".

## Repair

- `editSketch` records the main profile's side ids (`SketchState.mainIds`).
- `reopenedOrder` orders the shapes for Finish and for Trim/Split/Extend:
  - the shape with those ids first;
  - then the other finished shapes in their stored order;
  - then the shape being edited.

  This applies whether or not a shape is being edited. A main circle that a click attached to the outline comes back as its own shape. With no match the old order is kept.
- `attachCircle` carries the clicked circle's id into the outline's `circleIds`.
- When a circle is pulled out of an outline, `rulesWithoutCircle` drops the rules that name it and renumbers the rules for later circles. It covers cdist/cdx/cdy/cedge/ctan and ccdist/ccdx/ccdy/cconc.
- `trimSketch` also clears `editDim`.

## Retained failures and corrections

1. **No Studio baseline run.** The Model probe and the hook tests fail without the fix; these are the baseline.
2. **Audit round 1: CHANGES_REQUIRED.**
   - F1: Finish or Trim with no edited shape still swapped.
   - F2: a click on the main circle lost its role and id.
   - F3: a stale test asserted the bug.
   - F4: the region order alternated.
   - F5: the slot was never affected.
   All were fixed.
3. **Audit round 2.** F1–F5 were resolved, but it found a new regression, N1. Pulling the main circle out left circle-indexed rules pointing at another circle, so a dimension moved to the wrong circle and Finish was refused with "Shapes 3 and 4 overlap". It also found test gaps (N2). Both were fixed.
4. **Audit round 3: PASS.** 14/15 mutants were killed. The survivor is the untested `editDim` clear.
5. **Actual runs.**
   - Run01 passed before the audit fixes.
   - Run02 failed in the driver: its pick check looked for "Diameter", but the panel says "Picked circle 1".
   - Run03 failed in the oracle: the screen click split the edge at x = 29.99999999999997, and the oracle required exactly 30. The product steps passed.

## Verification

- **Model:** 21 new tests. Affected checks pass 183/183. Types and lint PASS.
- **Studio:** 3 new hook cases; affected 39/39. The D356 drop case now resizes the circle, because it had relied on the bug.
- **Docs:** check-docs and inventory PASS.
- **Actual [run-04](studio/run-04/receipt.json):** one Chrome, two contexts, 6/6 oracles.
  1. Open the fixture: a circle bound to R with a rectangle region, extruded by 10.
  2. The Extrude editor shows the circle's fields.
  3. Reopen and Finish unchanged: nothing changes and no toast appears.
  4. Reopen, click the circle, Finish: nothing changes and no toast appears.
  5. Reopen, Split the rectangle's bottom edge, Finish: the circle stays the main profile, R stays bound, its id stays `e1`, and the region has 5 lines with area 200. Then Undo.
  6. Set R = 6: volume 10(36π + 200).
  7. Undo/Redo, Save, fresh Open: the document is equal.
  - Errors 0. All 986 frozen files equal the commit.

## Boundaries

- Region order flips once when circle regions are stored after a polygon region. Geometry, ids and references are unchanged.
- A dimension from the rectangle to the main circle is dropped on Finish. This is the existing region limit.
- NOT_RUN: full suites, remote CI, release.
