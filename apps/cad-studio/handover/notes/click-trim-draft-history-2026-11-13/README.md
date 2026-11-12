# D874 — Undo and Redo an ordinary click Trim in the sketch

P1, rows 09 and 16. FEATURE for the [D873](../click-trim-draft-history-baseline-2026-11-13/README.md) defect. One successful click Trim records the active shape, finished shapes and linked state before and after the cut. The Studio stack checks document, plane, feature index and draft ownership. It preserves the existing outline-only semantics for dimension edits. The toolbar and keyboard use the same local history while the sketch is open. The stack is private to Studio. The published Model `SketchHistory` and file format are unchanged.

| Result | Check |
| --- | --- |
| PASS | Actual Studio removed the bounded 20 mm bottom interval and then the top edge. Toolbar Undo restored only the top edge. Keyboard Undo restored the bottom interval from (10, 0) to (30, 0) mm. The two construction boundaries retained all their original spans. |
| PASS | An empty Trim click was refused and left Redo available. Redo restored only the first cut, and the open profile refusal retained the accepted source. Undo restored the interval and cleared the inline Finish refusal. |
| PASS | Toolbar Redo applied both cuts. Two Undo key events in one browser task restored both steps in order. The same accepted document, selection, History and clean state were observed throughout. The current body stayed at 1,600 mm³. |
| PASS | Escape and Edit sketch returned to the original outline. The reopened sketch did not replay the previous session's Redo. The current D871 desktop regression retained dimension add/remove, Undo/Redo, read-only inspection and fresh Open. |
| PASS | Studio 70/70, Model 31/31, both type checks, build, scoped lint, syntax and diff checks. Independent review checked rapid input, exact owner and toolbar paths. The two desktop runs held 358 and 829 inputs through cleanup with zero errors, downloads and source changes. |
| FAIL | D873 recorded the original draft Undo defect. The first implementation type check found hook fixtures without a Trim recorder. The internal callback now preserves those callers. |
| NOT_RUN | Cross-tool outline repartition, no-op Finish after that repartition, drag Trim, accepted Save/Open of a repaired cut, mobile and full suites. |

D875 checks the transition between Trim and Select where the same closed outline moves into the active slot. [#2328](https://github.com/barocss/barocss/issues/2328) stays open for its drag gesture. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
