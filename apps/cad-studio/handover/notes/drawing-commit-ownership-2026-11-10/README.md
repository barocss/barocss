---
work_id: D576
artifact_type: drawing-commit-ownership-qualification
status: fixed-and-qualified-for-front-and-auto-dimension-desktop
last_updated: 2026-11-10
---

# D576 — Report drawing changes only after commit acceptance

P0, rows 11 and 16. Use the SMALL tier for the private Studio repair in [#2359](https://github.com/barocss/barocss/issues/2359).

## Actual Studio

Use the retained R14 starter plate with existing dimensions for a manual Front view side change. Use the retained R14 cross-hole block with a blank drawing for Auto-dimension, whose information heuristic chooses the front from +X. In two isolated desktop contexts, hold the unchanged successful +X Worker projection response. Commit a newer title through the visible Drawing title field before releasing the reply.

Before the fix, Studio keeps the new title, original direction and dimensions, yet reports success. Manual Front reports that the front is now seen from +X. Auto-dimension reports six dimensions placed while the accepted drawing still has zero. The visible history and dirty state do not change when the stale responses arrive.

The existing App drawing commit now returns acceptance. The scope and active-sheet wrappers preserve this result. Front and Auto-dimension emit success only after acceptance. Accept all and Fix all use the same result for their notices, and a refused intermediate fix does not schedule another round.

After the fix, both delayed requests keep the title and show only the existing refusal. Both current actions then succeed. The plate retains six nominal dimensions after remapping, with the right and top views matching the retained fixture. The cross-hole block gains six dimensions including the 8 mm through-hole on the new front. First Undo and Redo restore exact settings in both cases. Root reviewed the actual Auto-dimension before, refusal and success captures.

The first fixed driver expected the old nominal label `Ø8`, while Studio displays `Ø8 THRU`. The corrected comparison checks the nominal diameter and retains the full display text in the receipt. The next run passes its product assertions but records a file watcher event. The frozen hashes match after cleanup. A fresh run of the same driver and product source passes with zero watcher changes. [Commands and receipts](qualification.json).

- **PASS** — two fixed desktop refusals and current successes, first Undo/Redo, focused commit/remap/layout tests, both type checks and Studio build.
- **FAIL** — original desktop reports success for both refused commits. The first two fixed harness attempts stop at the label comparison and watcher check respectively.
- **NOT_RUN** — separate refusal replays for Accept all and Fix all, multi-sheet and mode changes during a pending action, native Save and fresh Open, independent SVG readback, full kernel and mobile.

[#2359](https://github.com/barocss/barocss/issues/2359) remains open for remaining acceptance. Next is D577, P0 rows 06 and 16. Check whether a late local image decode can replace a newer render texture or environment, or apply after closing its owner, for [#2419](https://github.com/barocss/barocss/issues/2419). Whole CAD remains NOT_MEASURED.
