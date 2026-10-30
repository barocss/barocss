# D366 — Ellipse sketch tool

Status: **BOUNDED_QUALIFIED**. The owner ordered this item on 2026-10-30 ("Ellipse first"): the one bounded conic item before bounded 09 closes. Source commit `d07c5be59` (27 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md). Related: #2265 and #2259 (kernel fillet throughput and its 64-edge limit; the coordinator attaches [the repro](audit/fillet-scaling.md)).

## What it does

- **Drawing.** The **Ellipse** tool (key I) takes three clicks: the centre, the end of the first axis (this sets Rx and the angle), and a point whose distance from that axis sets Ry.
- **Stored definition.** The sketch keeps `{center, rx, ry, angle}` while its outline still matches it.
- **Panel.** The ELLIPSE section edits Centre X/Y, Rx, Ry and Angle. Enter applies a value without finishing the sketch. Angles are stored in [0, 360).
- **Profile.** The kernel builds lines and arcs, so the profile is 192 tangent arcs through 96 points that lie exactly on the ellipse, with exact tangents. It stays within 1e-5 of the longer semi-axis for ratios down to 1 : 5 ([measurement](measure/table.txt): worst 6.52e-6). The point count is fixed, so the side ids never change when the ellipse is edited.
- **Make curves.** It gives the exact ellipse as a rational quadratic NURBS: the circle's quarter spans mapped affinely, 9 poles.
- **Panel tidiness.** The constraint list shows one "Ellipse · 192 tangent arcs" row instead of 192 arc rows. The point table and the tangency and arc-pair chips are hidden.
- **Refused shapes.** Ratios below 1 : 5, non-finite values, and shapes beyond the kernel's limits on coordinates, arc centres and radii are refused with a reason.
- **Fillets and chamfers on its side edges are refused, with the reason.** This covers extrudes, revolves, sweeps and pattern copies, and the chat `add_features`/`edit_feature` paths too. On 192 side faces the kernel takes about 112 s for one edge and caps a rim at 64 edges ([scaling table](audit/fillet-scaling.md)). Documents made before this change still open and evaluate, slowly.

## Retained failures and corrections

1. **Choosing N.** The brief's set {16…48} could not reach 1e-5, so N = 96 was taken. A warm re-evaluation costs about 12 ms; the first evaluation is about 250–340 ms.
2. **Audit round 1: CHANGES_REQUIRED.**
   - F1 (high): the slow one-edge fillet and the refused rim.
   - F2: the definition is kept only on the main shape; documented.
   - F3: a stale comment.
   - F4: the angle was not normalised.

   Root decision: keep the accuracy and refuse fillet/chamfer on the side edges.
3. **Audit round 2: CHANGES_REQUIRED.**
   - R1 (high): the refusal read a feature id as a node index, so it was missed after a delete and misfired on another extrude.
   - R2: the chat path bypassed it.
   - R3: sweep face names were not matched.
   - R4: documentation of older documents.

   All fixed, with negative tests.
4. **Audit round 3: PASS.** 47/50 mutants killed. Root then added the `@<k>` pattern-copy suffix and its test.
5. **Actual runs.**
   - Run01 passed.
   - Run02 failed in the driver: the toast text starts with "info".
   - **Run03 failed on the product:** after a reopen, the settled constraint list (`ConstraintTools`) still listed the 192 arc rows. Fixed.
   - Run04 failed in the driver: the toast was not dismissed.
   - Runs 05 and 06 passed on intermediate source.
   - Run07 passed on the final merged source.

## Verification

- **Model:** affected 325/325, including `sketch-ellipse` and `sketch-ellipse-side`. Types and lint PASS.
- **Studio:** 64/64. Types PASS.
- **Docs:** check-docs, refusals and inventory PASS.
- After merging origin (D364/D365) the same suites pass again, at `56a67ebdd`.
- **Actual [run-07](studio/run-07/receipt.json):** one Chrome, two contexts, 6/6 oracles. The steps:
  1. Draw the ellipse.
  2. Edit Angle and Ry in the panel.
  3. Finish: 192 points and 192 ids. The oracle checks the fit points, the 1e-5 bound and the area.
  4. Extrude: the volume equals the outline area × height.
  5. The rim Fillet is refused.
  6. Reopen: one summary row.
  7. Set Rx to 60: the ids stay and the volume follows.
  8. Try Ry 5: it is refused.
  9. Undo/Redo, Save, fresh Open.
  10. Make curves: the oracle evaluates the NURBS at 801 parameters, each on the ellipse to 1e-9.
  - Errors 0. All 897 frozen files equal the commit.

## Boundaries

- There are no dimensions or constraints on an ellipse; the solver allows at most 64 segments.
- There are no centre or quadrant snaps.
- Sheet-base and sweep-curve side names are not covered by the refusal.
- Run-07 used the tree before the D364/D365 merge; only unit suites were rerun after it.
- NOT_RUN: full suites, remote CI, release.
