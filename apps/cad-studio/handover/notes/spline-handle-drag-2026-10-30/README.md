# D353 — Drag spline handles and fit points in the viewport

Status: **BOUNDED_QUALIFIED**, the sixth bounded item of roadmap 09. Source commit `47e8617ea` (6 paths: `Viewport.tsx`, new `viewport/splineHandles.ts`, `styles.css`, unit test, Studio driver, `sketches.md`). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md). Related issue #2051 (Bezier control points): related but not satisfied, so it stays open; epic #532 also stays open.

Work split: root judgment and verification on Opus; independent audit on an Opus sub-agent; feature, audit fixes and driver by Sonnet sub-agents in this worktree. Root added the driver's click-pick step. Codex "Sol" models were not used.

## What it adds

With **Select** on a closed spline that still matches its definition, pressing a handle end (30 px, 8 px pick radius) or a fit point arms a drag.

- **Activation.** Past 3 px of movement the drag either turns the handle (whole degrees, Shift for 0.1°, +180° for the back end) or moves the fit point (grid step, Shift for fine).
- **Preview.** The drag previews through the live shape with no history step. A position with no buildable or admissible arc pair keeps the last valid preview.
- **Release.** Release applies one undo step, and only when the definition changed. A release before 3 px is an ordinary pick.
- **Cancel.** Escape, pointer cancel, lost capture or a tool change cancels the drag. Keys are swallowed during a drag. A shape that changed underneath is not overwritten.
- **Display.** Handle marks are distinct (light theme too). Radius chips are hidden on a closed spline so they do not cover the handles.

## Retained failures and corrections

1. Actual run01 passed on the pre-audit source.
2. The independent audit returned CHANGES_REQUIRED, and all findings were fixed:
   - **F1 (high):** clicks on fit points no longer picked; 26–28 % of outline click samples started a drag.
   - **F2:** the drag used a stale start shape.
   - **F3:** cancelled or second pointers leaked the drag.
   - **F4:** empty or jitter drags emitted a change.
   - **F5:** radius chips covered handle ends.
   - **F6–F8:** open splines, the Dimension tool and the cursor.
   - **F9:** weak tests (surviving mutants M1, M11, M14, M6, M12).
   - The audit found no kernel or settle failure in 39,858 grid drags and 1,200 chained drags, and the performance cost is negligible.
3. Run02 after the fixes includes the F1 proof: a click on a fit point picks it and changes nothing.

## Verification

- **Studio:** `spline-handle-drag` has 11 tests (geometry, nearest-wins, the 8 px boundary, degenerate projections, angles, snapping, threshold, definition equality). Affected 43/43. Types and lint PASS. The fixer's mutation run kills M1, M6, M9, M11, M12, M13 and M14; M10 is equivalent.
- **Docs:** check-docs PASS.
- **Actual [run-02](studio/run-02/receipt.json):** one Chrome, two contexts.
  1. Draw a closed spline. The 12 handle ends are drawn, and they agree with the projection within 2 px.
  2. Hovering shows `grab`. A click on a fit point picks it.
  3. Drag a handle to 60°. During the drag the cursor is `grabbing` and nothing is emitted. One Meta+z / Meta+Shift+z undoes and redoes it.
  4. Drag fit point 4 to (−36, 2).
  5. Press Escape during a drag: it cancels.
  6. Drag a point onto its neighbour: it stays at its last valid position (−35, 1).
  7. Finish, Extrude, Save.
  8. Fresh Open, reopen: the values are restored.
  - Four product reads and four independent Python Fraction oracles PASS.
  - Errors, console errors and watcher changes 0. All 986 frozen files equal the commit.
  - Root viewed the drag preview and the fit-dragged images.

## Boundaries

NOT_RUN: full suites, remote CI, release. Limits:

- Closed splines only.
- Directions only, with no handle magnitude or Bezier control points.
- A refused drag can stop very close to a neighbour.
- In an edge-on view all targets collapse to one screen point.
- The pointer-cancel and second-pointer paths are verified by reading and unit logic only, not driven in the browser.
