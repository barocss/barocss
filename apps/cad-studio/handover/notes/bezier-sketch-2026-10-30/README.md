# D354 — Quadratic and cubic Bézier curves from control points

Status: **BOUNDED_QUALIFIED**, the seventh bounded item of roadmap 09. Source commit `8c396c876` (20 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

**Related issues**
- #2051 §2 (Bézier control-point authoring) is delivered. §1 (circle/arc authoring) and §3 (extend vs split) are other scope, so the coordinator should check closure section by section.
- Epic #532 stays open.

**Work split.** Root (Opus) did judgment and verification. An independent Opus sub-agent audited. Sonnet sub-agents wrote the feature, the audit fixes and the driver in this worktree. Codex "Sol" models were not used.

## What it adds

- **Tool.** Bézier tool `B`: click control points. The 3rd click makes a quadratic; a 4th makes a cubic and ends the shape. A click on the previous pole is ignored, and degenerate curves are refused.
- **Display.** The dashed control polygon (`sk-guide`) and the solid curve (`sk-shape`, 33 display samples) are drawn separately. The curve does not pass through the middle poles.
- **Panel.** The panel's **BÉZIER** section edits `Control point N X/Y` (Enter or blur). Edits that `bezierError` refuses show the reason.
- **Profile and storage.**
  - A Bézier is never part of a profile.
  - Finish keeps it in the node's `construction` array, always without the construction flag; reopen restores it for ordinary sketches. Malformed stored entries are ignored.
  - Select reaches the profile even when a Bézier is the current or last shape.
- **Make curves.** Make curves turns it into an exact degree-2/3 NURBS direct curve (clamped knots, unit weights, poles mapped by the sketch plane, 1e-9 decimal source form) that Loft's guide admission accepts. Errors show as a toast.

The kernel's extrude profile takes only lines and arcs, so a Bézier is not a profile edge. Exact use goes through Make curves.

## Retained failures and corrections

1. Actual run01 failed on the driver's history locator for a standalone sketch. Steps through Finish passed.
2. Actual run02 passed on the pre-audit source.
3. The independent audit required two fixes and found lower-severity items:
   - **Required:** a malformed stored Bézier crashed snaps and Make curves.
   - **Required:** the tests were too weak (10 of 13 mutants survived).
   - **Lower:** Select was blocked; construction mode was not stripped; degenerate curves were accepted; Make curves gave no error message; the docs overstated behaviour.

   All of these were fixed. The probes and mutants before and after are kept in [audit](audit).
4. Run03 is the qualifying run.

## Verification

- **Model:** 15 new tests. Affected 271/271. Types and lint PASS. All non-equivalent mutants are killed.
- **Studio:** 5 new tests use the real hook. Affected 48/48. Types PASS.
- **Docs:** check-docs PASS. The API inventory was regenerated and verified equal to a fresh regeneration.
- **Actual [run-03](studio/run-03/receipt.json):** one Chrome, three contexts.
  1. Draw a rectangle and a quadratic.
  2. Edit control point 2 Y from 60 to 50.
  3. Finish: the Bézier is stored in `construction`.
  4. Save, fresh Open, reopen: the Bézier is drawn.
  5. Draw a cubic.
  6. Make curves: 3 direct curves are created. Undo/Redo.
  7. Save, fresh Open: the curves are kept.
  - Two independent Python Fraction oracles PASS. B(1/2) = (10, 45, 0); the end tangents are (20, 20, 0) and (20, −20, 0); the cubic matches Bernstein at 1/4, 1/2 and 3/4. The product's evaluation differs by 0.
  - Errors, console errors and watcher changes were 0. All 713 frozen files equal the commit.
  - Root viewed the cubic and quadratic image.

## Boundaries

NOT_RUN: full suites, remote CI and release.

Limits:
- After reopen, the Bézier is shown but is not the editable current shape.
- Linked sketches drop construction shapes (pre-existing).
- A Bézier is not a trim or extend boundary, and it is not exported to DXF.
- The OFFSET section still shows for a current Bézier; Offset is refused with a message.

Side note: reopening renames a rectangle's side ids. This is pre-existing and is the next item, D355.
