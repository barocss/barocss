# K12 notes left by the R5 kernel session (2026-10-24) — not committed, no T2 finished

Scratch worktree: k12 (detached at 9b4e90f3e, D233). Patch: k12-pole-split.patch (src/brep/analytic-boolean.ts + test/boolean-through-pole.test.mjs).

## Candidate fix: a traced curve through a pole is cut there (fuzz 110 family)
- `addCut` splits a `param` cut where it passes within 10 tol of a nurbs face's pole strictly inside the curve
  (`throughPole`, 64 samples + golden section); its ends stay with D208's `toPoles`.
- Why: on the pole's surface the curve arrives at and leaves the pole's domain side at two u values; one cut across it
  gave `curveFaceRegions` 0 regions, the face vanished, the stitch refused (edge used once).
- Effect (k12, single runs): 110 with the cylinder from z 2.5 (union and difference) refused → valid (0.29 e, −0.19 e);
  110 as fuzzed still refused (next: a micro edge used 6 times 0.055 from the Viviani double point, where the cylinder's
  bottom circle is also tangent to the ball's equator); 110 with the cylinder from z 1 still refused near the north pole.
- T2 was started and stopped by the coordinator's track-boundary call: nothing verified.

## Triage of the other near-degenerate refusals (diagnosis only)
- 51: the cylinder's seam ruling is tangent to the ball (distance from the ball's centre to the line = r); the
  intersection touches the seam; a micro piece lands on the other half-face (edge used once).
- 74: in the coplanar bottom (z −2), the cone's base circle is tangent to the box's bottom edge y = 4 at (2, 4); the box
  edge's part outside the circle (y 3.873→4 at x 1) ends up an edge used once.
- 85: a self-touch refusal (D205's ruling) — likely correct as it is.
- 25, 119, 170: not looked at in this session (170: pole-safe map per D204's draft note).
