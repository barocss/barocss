---
work_id: D559
artifact_type: body-clipboard-failed-open-qualification
status: qualified-for-two-native-open-refusals
last_updated: 2026-11-10
---

# D559 — Verify clipboard and history after a failed native Open

P0, rows 12 and 16. The parent is `d86e8dd7c0b77131d5a46559aa5a4ec7a7f966e6`. This is the failed-Open case in [#2310](https://github.com/barocss/barocss/issues/2310), after the [D558 pending Paste case](../body-clipboard-pending-2026-11-10/README.md). The delivery adds a desktop regression driver.

## Actual Studio

Open the retained D326 B box, 12 × 13 × 14 mm. Copy b1 and Paste once to create b4 at X +22 mm. Nudge b4 to X +23 mm and Undo the nudge. The current document has the first copy and both history stacks have entries. The selected body is b4.

Use the Open toolbar button and browser file chooser for two failed .bcad opens. The first payload is malformed JSON. The second is the retained document with only its schema value set to 5, above this reader's supported maximum of 4. Studio displays a specific refusal for each. At both refusal boundaries the exact accepted document, body results, selection, file name, dirty state, history rows and Undo and Redo controls match the prior state.

After both failures, Redo restores the exact +23 mm nudge. Undo returns to the first-Paste document, and the next Undo returns to the original box. Redo restores the exact first-Paste document. Paste creates b7 at X +44 mm without another Copy. The accepted Paste clears the previous Redo branch. Undo removes that Paste and Redo restores it exactly. Independent box arithmetic checks four states at an absolute tolerance of 1e-9. The final bodies have volume 2,184 mm³ each and X centroids at 6, 28 and 50 mm.

The actual run passed with 13 snapshots and four independent joins. Root reviewed the unsupported-schema refusal and the next Paste captures. The refusal notice remained visible in the next Paste capture. The run verified 299 source pins through cleanup. The owned context, Chrome and Vite closed. Commands, hashes, timing and cleanup evidence are in [qualification](qualification.json).

- **PASS** — both selected failed native opens, the exact Undo and Redo replay, retained clipboard and +44 mm next Paste, driver syntax and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — file chooser cancellation, other Open failures and replacement routes, full kernel and mobile.

[#2310](https://github.com/barocss/barocss/issues/2310) remains open. Next is D560, P0 rows 12 and 16. Check stale Paste after New part reuses the original document's local body key. Whole CAD remains NOT_MEASURED.
