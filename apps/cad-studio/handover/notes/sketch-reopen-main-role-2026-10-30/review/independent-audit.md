# D358 independent audit (claude-opus-5-5 sub-agent, three rounds, 2026-10-30)

The audit was read-only, on 14df7cb18 plus the D358 diff. Probes `p1`–`p5` (templates `*.tpl.ts`, base and current outputs) and the mutation sweeps (`muts*.json`, `mutrun*.py`, `mut*.txt`) are in [../audit](../audit). The outputs are labelled `cur` (round 1), `cur2` (round 2), `cur3` (round 3) and `base`.

## Round 1: CHANGES_REQUIRED

The claim held for an untouched reopen→Finish. The real hook was used, with two round trips, on these cases:
- circle with one region;
- circle with holes;
- circle with a region and a hole;
- a pre-R10a node with a binding;
- a polygon main with a circle region;
- an outline with an attached circle;
- a circle with a circle region.

Findings:
- **F1 (medium): fixed.** Finish with no edited shape ignored the main ids, so the main still swapped. The paths were Split/Trim/Extend, Offset and a tool switch without drawing. Fix: `reopenedOrder` is used whenever the sketch is reopened, in both Finish and `trimSketch`.
- **F2 (medium): fixed.** A Select or Dimension click on the main circle ran `attachCircle`, which dropped the circle's id. Finish then made the rectangle the main profile and renumbered the circle (`e1` → `e6`), so a fillet on it failed.
  - Fix: `attachCircle` carries the id.
  - Fix: `reopenedOrder` brings an attached main circle back as its own first shape.
- **F3 (low): fixed.** A parameters test asserted the bug through a helper with no main ids.
- **F4 (low): fixed.** With two or more regions the order alternated on every no-op round trip. The rest now keeps the stored order: other finished shapes first, the edited shape last.
- **F5 (low): docs corrected.** A reopened slot was never moved, so the docs no longer mention slots.
- **Mutants:** 10 of 12 were killed; the 2 survivors were equivalent.

## Round 2: CHANGES_REQUIRED

F1–F5 were resolved. The regression probes (p4) covered:
- fresh sketches;
- polygon mains with circle regions or holes;
- out-of-step ids;
- a new shape drawn during a reopen;
- Undo inside the sketch;
- the D355/D356 tests.

The new behaviour equalled or improved on base in each.

- **N1 (medium, new regression): fixed.** `dropCircleAt` left the outline's circle-indexed rules unchanged. After a split, a dimension on circle 1 moved to another circle, and Finish was refused with "Shapes 3 and 4 overlap" (p5).
  - Fix: `rulesWithoutCircle` drops rules that name the circle and steps down later indices. It covers cdist/cdx/cdy/cedge/ctan `.circle` and ccdist/ccdx/ccdy/cconc `.a/.b`.
  - The other rule kinds name only points and edges.
- **N2 (low): fixed.** Two mutants survived. Added a Studio tool-switch test with two regions and the `attachCircle` id-count guard test.
- **N3 (low): open.** Circle regions stored after a polygon region flip order once, then stay stable. Geometry and ids are unaffected.
- **N4 (note): existing limit.** A dimension from the rectangle to the main circle is dropped on Finish, because regions keep no constraints.

## Round 3: PASS

- The p5 rule renumbers onto the right circle. Finish gives a circle main with R bound and no toast.
- p1–p4 are byte-identical to round 2.
- Mutants: 14 of 15 killed. The survivor is W6, the `editDim` clear in `trimSketch`, which has no test. A tool switch already clears `editDim` before a trim.
- Checks: Model 183/183, Studio 39/39, tsc for both.
