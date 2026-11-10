---
work_id: D557
artifact_type: studio-document-file-action-extraction
status: qualified-for-selected-desktop-file-actions
last_updated: 2026-11-10
---

# D557 — Extract Studio document file actions from App

P4, row 22. The owner selected the App.tsx refactor after [D556](../body-clipboard-history-2026-11-10/README.md). The parent is `c2b9c9fbca85375703e1928a7b7834777ca241ed`. The pending clipboard case moves to D558.

The private `useStudioDocumentFiles.ts` owns file Open, import intake and repair entry, Save, Share and post-Open reference verification. App still owns the accepted document, Undo and Redo, replacement, project lifecycle, recovery state and Worker restart. The hook reads the same Open, dispatch and Worker owners through typed inputs. The mesh import effect keeps its place before blob eviction. App.tsx goes from 2,444 to 2,365 lines. The new module has 153 lines.

The source comparison matches the ten moved initializers after substituting the equivalent inputs and callbacks. Ten retained App owner functions or values match their parent source. The refactor introduces no product API or document data change.

## Actual Studio

Root ran one desktop flow with four groups and five snapshots. Opening the retained signed fixture holds one lost feature, preserves its stored edge names and shows two evaluated bodies. Opening malformed native JSON shows the refusal and keeps the accepted document and dirty state. Opening the local triangle STL shows the Mesh units dialog. Cancel preserves the same accepted document and dirty state. Save writes the document to a fresh browser project, clears the dirty state and preserves the exact document. Reading the saved native JSON through the project directory yields the accepted document.

The malformed-file notice remained visible after the subsequent actions in the captured run. The browser flow recorded zero downloads, page errors, console errors or source changes. It verified 759 source pins through cleanup. Its context, Chrome and Vite closed, and its owned PIDs were absent. Commands, runtime counts and hashes are in [qualification](qualification.json).

- **PASS** — source comparison, driver syntax, Studio and final Model types, 49 focused tests, four selected actual file-action groups and owned cleanup.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — local file Save and Share downloads, successful mesh import, other imported format routes, late-save runtime variants, full kernel and mobile. Whole CAD is NOT_MEASURED.

Next is D558, P0 rows 12 and 16. Check Paste during an owned pending evaluation. A refused attempt must preserve history, selection and the next paste offset. [#2310](https://github.com/barocss/barocss/issues/2310) remains open.
