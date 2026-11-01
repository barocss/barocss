# D352 — Spline fit points and editable tangent handles (first version)

Status: **BOUNDED_QUALIFIED**, the fifth bounded item of roadmap 09 (owner-requested spline handles). Source commit `cfc78bd8c` (15 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md). Related issue: #2051 (Bezier control-point authoring). This is related, but its acceptance is **not** met and it stays open; epic #532 also stays open.

Work split: root judgment, design freeze and verification on Opus; independent audit on an Opus sub-agent; feature, audit fixes and driver by Sonnet sub-agents from frozen briefs, working directly in this worktree. Isolated worktrees are cut from an old commit, so they were not used. Root made the two run-found product fixes and the driver adjustments. Codex "Sol" models were not used.

## What it adds

- **Definition.** A Spline-tool outline keeps `spline: { fit, closed, handles? }`. A handle is the tangent direction in degrees at a fit point, counter-clockwise from +X in the direction of travel; null or missing means automatic. The definition is stored in `SketchOutline.spline` by `outlineOf` only while `splineMatches` holds, restored by `outlinePolygon` (malformed values are ignored) and dropped by `settleShape` when an edit, dimension or relation no longer matches it.
- **Stable side ids.** Every span is exactly two pieces, a biarc or two straight halves, with the fit points at even indices. Changing a point or handle therefore keeps the side ids, and downstream features keep their references.
- **Editing.** The sketch panel's **SPLINE** section (shown once the Spline tool is put down) edits each fit point's X/Y and handle. Values apply on Enter or blur; an empty handle means automatic, and the placeholder shows the automatic angle.
- **Refusals.** An edit that leaves no buildable or kernel-admissible arc pair is refused with a reason, and the shape is left unchanged. The checks are a missing biarc, coordinates or an arc centre beyond ±10000 mm, a radius below 0.01 mm, a line shorter than 1e-4 mm, and coincident neighbouring points.
- **Viewport.** Handle marks are drawn. Dragging them is not part of D352.

## Retained failures and corrections

1. The independent audit returned CHANGES_REQUIRED with findings F1–F9, all fixed:
   - F1: the refusal rule refused valid handles, including the automatic value.
   - F2: some accepted edits failed later in the kernel or solver.
   - F3: a dimension at its measured value kept the spline and was later deleted silently.
   - F4: values applied on every keystroke, so some angles could not be typed.
   - F5: a stale error message stayed.
   - F6: edits made while drawing were lost.
   - F7: biarc cancellation for near-parallel tangents.
   - F8: a malformed stored spline threw on reopen.
   - F9: 1 in 500 closings lost the definition.

   All nine probes now show the intended behaviour. The audit mutation run showed the side-name test was vacuous; it now starts from non-default ids.
2. Actual run01 failed on a product crash: the first Spline click shows a one-point spline, and computing its automatic handles crashed React. Root added a guard and a test. The unit tests had not caught this.
3. Actual run02 failed on a product defect: Enter in a SPLINE field also finished the sketch. Root added `stopPropagation`, as the edge length fields already do.
4. The driver set handle 90, which equals the automatic tangent and so changes nothing; it now uses 100. It also now selects the Select tool, presses Enter, and uses a coordinate beyond ±10000 mm for the refusal case.
5. No baseline browser run was made: the capability does not exist at base.

## Verification

- **Model:** 18 new tests in `sketch-spline-handles`. Affected 138/138 (`node scripts/test.mjs sketch spline corner trim reopen outline loops editFields`). One existing assertion changed (three collinear open points now give 5 pieces). Types and lint PASS.
- **Studio:** 32/32 (`constraints sketchIds sketch-edit-identity`); types PASS.
- **Docs:** check-docs PASS. The API inventory is regenerated: 6 new spline exports, and the polygon and outline types gained `spline`.
- **Actual [run-03](studio/run-03/receipt.json):** one Chrome, two contexts.
  1. A closed 6-point spline; switch to Select; set handle 100.
  2. Set Y = 20000 on point 2: refused with the reason, shape unchanged.
  3. Finish: `outline.spline` is stored, with 12 segments and 12 side ids.
  4. Extrude.
  5. Reopen: the handle is shown. Set point 4 X to −35 and the handle to 75, then Finish: same side ids, and the volume follows.
  6. Undo/Redo, then Save.
  7. An arc radius edit turns the curve into an ordinary outline (the section disappears); Escape leaves the document unchanged.
  8. Fresh Open, then reopen: the values are restored.
  - Six product reads and six independent Python Fraction oracles PASS: worst tangent 4.5e-16 rad, worst handle error 2.2e-16 rad, volume within 1e-6.
  - Errors, console errors and watcher changes 0. All 984 frozen files equal the commit.
  - Root viewed 07-edited.

## Boundaries

NOT_RUN: full suites, remote CI and release. Limits:

- Handles are directions only (biarc), with no magnitude. Bezier control-point authoring (#2051) is not provided.
- Handles are edited numerically; viewport dragging is the next item.
- Accepted handles can add a self-crossing (audit side note, not verified).
- Closed splines with 17 or more points carry no tangent constraints.
- Handle marks are hard to see because they lie along the curve.
