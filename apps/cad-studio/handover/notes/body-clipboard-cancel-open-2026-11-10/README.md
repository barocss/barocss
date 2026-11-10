---
work_id: D570
artifact_type: body-clipboard-cancel-open-qualification
status: qualified-for-chromium-native-file-input-cancel-event
last_updated: 2026-11-10
---

# D570 — Verify clipboard and history when Open is cancelled

P0, rows 12 and 16. This covers file chooser cancellation for [#2310](https://github.com/barocss/barocss/issues/2310), after [D569 text input routing](../body-clipboard-text-focus-2026-11-10/README.md) and [D559 failed Open](../body-clipboard-failed-open-2026-11-10/README.md). The qualification records the exact parent.

## Actual Studio

Open the retained 12 × 13 × 14 mm D326 B box. Copy b1 and Paste once at X +22 mm. Nudge the selected b4 to X +23 mm and Undo. Both Undo and Redo have entries.

Click the public Open button. Chromium's installed DevTools protocol cancels the chooser before drawing a native dialog. The actual Model file input receives one trusted cancel event with zero selected files. The observer records zero input and change events. The accepted document, evaluated bodies, selection, file name, dirty state, history rows and Undo and Redo controls stay exact.

Redo restores the nudge and Undo returns to the first-Paste document. Without another Copy, Paste creates and selects b7 at X +44 mm. Undo and Redo restore the exact documents around that Paste. Independent box arithmetic checks two states at an absolute tolerance of 1e-9. The final bodies measure 2,184 mm³ each, with X centroids at 6, 28 and 50 mm.

Root reviewed the cancelled-Open capture. The run records nine snapshots and two independent joins. Commands, hashes and cleanup are in [qualification](qualification.json).

- **PASS** — public Open and browser-native cancel event, exact CAD state and history, retained clipboard and next +44 mm Paste, driver and helper syntax, final Model types and cleanup.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — operating the visible OS dialog, other browser implementations, full kernel and mobile.

Next is D571, P0 rows 12 and 16. Check the user-visible Copy notice when a document boundary invalidates its clipboard. The D560 and D566 captures show the previous Paste instruction after invalidation. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
