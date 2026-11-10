---
work_id: D568
artifact_type: body-clipboard-save-reopen-qualification
status: qualified-for-two-copies-through-native-save-and-fresh-open
last_updated: 2026-11-10
---

# D568 — Verify native Save and fresh Open of both pasted bodies

P0, rows 12 and 16. The parent is `6325cbca0f0c863a0df313b0d52341e9bb90f581`. This covers persistence of both Paste results for [#2310](https://github.com/barocss/barocss/issues/2310), after [D567 project autosave Restore](../body-clipboard-project-autosave-2026-11-10/README.md).

## Actual Studio

Open the retained 12 × 13 × 14 mm D326 B box. Copy b1 and Paste twice, at X +22 and +44 mm. Studio has eight distinct authored feature IDs and three outputs, b1, b4 and b7. Each new extrusion uses its own copied sketch and each move uses its own copied extrusion. The original nodes match the retained document.

Save the accepted document into a browser project. The Save clears the dirty state. Read the actual 2,069 native bytes from browser project storage. The decoded document matches the accepted document exactly, including both copied feature chains and offsets. Pass those same bytes to the public Open file chooser in a fresh browser context. The reopened document, bodies and references match. Press Paste before copying in that context. The reopened document, three evaluated bodies, selection, file name, dirty state and history controls stay exact.

Independent box arithmetic checks three states at an absolute tolerance of 1e-9. The reopened bodies measure 2,184 mm³ each, with X centroids at 6, 28 and 50 mm. Root reviewed the three boxes in the fresh Open capture. The run recorded six snapshots. Commands, hashes and cleanup evidence are in [qualification](qualification.json). The native bytes remain in external evidence.

- **PASS** — both Paste results, native browser-project Save, exact bytes and feature references, fresh Open, stale Paste state and history, driver and helper syntax, and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — standalone file download, text-input clipboard focus, other body types and storage routes, full kernel and mobile.

Next is D569, P0 rows 12 and 16. Check shortcut isolation while a text input has focus. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
