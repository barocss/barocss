---
work_id: D569
artifact_type: body-clipboard-text-focus-qualification
status: qualified-for-file-name-input-shortcut-isolation
last_updated: 2026-11-10
---

# D569 — Verify body clipboard isolation while a text input has focus

P0, rows 12 and 16. The parent is `c9950d103342cf5b459f47072f17521b8bd97126`. This covers text-input shortcut routing for [#2310](https://github.com/barocss/barocss/issues/2310), after [D568 native Save and fresh Open](../body-clipboard-save-reopen-2026-11-10/README.md). The delivery adds a desktop regression driver.

## Actual Studio

Open the retained 12 × 13 × 14 mm D326 B box. Copy b1 and Paste once at X +22 mm. Nudge the selected b4 to X +23 mm and Undo. The original b1 remains in the body clipboard. The different body b4 stays selected, and both Undo and Redo have entries.

Focus the real File name input and select its text. Send trusted Meta+C, Meta+V, Ctrl+C and Ctrl+V key events through Chrome. A Window listener registered after Studio's listener records the target, focus and default-prevention state. Studio leaves all four defaults available. The test observer cancels the subsequent native action to keep the system clipboard outside this test. The four snapshots preserve the exact document, bodies, selection, file name, dirty state, history rows and Undo and Redo controls.

Leave the input via the Model button. Redo restores the exact nudge and Undo restores the first-Paste document. Without another Copy, Paste selects b7 at X +44 mm and uses a fresh copy of the original feature chain. Undo and Redo restore the exact documents around that Paste. Independent box arithmetic checks two states at an absolute tolerance of 1e-9. The final bodies measure 2,184 mm³ each, with X centroids at 6, 28 and 50 mm.

The first run passed setup and timed out locating the input by its exact accessible name while the dirty badge was present. The second driver targets the same rendered input directly. The driver is the only source pin that differs between runs. Root reviewed the focused-input capture. The passing run records 13 snapshots and two independent joins. Commands, hashes and cleanup are in [qualification](qualification.json).

- **PASS** — trusted shortcut routing in the File name input, exact CAD state and history, original body clipboard and next +44 mm Paste after focus leaves, driver and helper syntax, final Model types and cleanup.
- **FAIL** — the first harness locator timed out before text shortcut input.
- **NOT_RUN** — native OS text transfer, other text input controls, file chooser cancellation, full kernel and mobile.

Next is D570, P0 rows 12 and 16. Check clipboard and history preservation when Open is cancelled without a file. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
