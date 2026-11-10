---
work_id: D572
artifact_type: library-source-selection-qualification
status: fixed-and-qualified-for-local-panel-insert-and-place
last_updated: 2026-11-10
---

# D572 — Insert and place the library part shown in Studio

P0, rows 16 and 28. This is the local-file panel path of [#2361](https://github.com/barocss/barocss/issues/2361). Use the SMALL tier for this Studio consumer fix.

## Actual Studio

Open a native document with embedded library A. Load local file B through the Library panel. Both libraries use the same library, part and variant IDs. Both describe a spacer with an outer diameter of 10 mm and a bore of 5.3 mm. A is version 1.0.0 and 8 mm high. B is version 2.0.0 and 12 mm high. Repeat the setup in a separate browser context for Place.

| Action | Selected source | Before the fix | After the fix |
| --- | --- | --- | --- |
| Insert | B, 12 mm | A, 8 mm, 451.823855439 mm³ | B, 12 mm, 677.735783159 mm³ |
| Place | B, 12 mm | A, 8 mm, 451.823855439 mm³ | B, 12 mm, 677.735783159 mm³ |
| Insert with a different file under A's name and version | New-only variant, 14 mm | NOT_RUN | New-only variant, 14 mm, 790.691747019 mm³ |

Before the fix, each action silently replaces B in the browser's library store with A. The fix checks the displayed entry before calling the synchronous model helpers. It omits the embedded library list from the lookup and restores the list before commit. The same resolved variant drives the select control and the two buttons. A changed registry entry is refused before any write. The ID-based model APIs retain their existing document-priority contract for their other callers.

The fixed Studio flow preserves the embedded agent library and its unconfirmed state, as well as the selected person's library and its licence in the browser store. First Undo and Redo recover the exact documents in all three cases. Save writes the placed instance to a local browser project. Fresh Open of those exact bytes in a context without B retains its evaluated placement bounds, source and geometry. Root reviewed the fresh Open image with the rendered spacer and its Browser row.

An independent Python check compares each evaluated volume with `π × (5² − 2.65²) × height` and checks the centroid. The placement cases also check the live viewport Z extent against the literal height. The absolute tolerance is 1e-6 mm or mm³. Insert reads the actual Studio Worker result. Place reads live Studio bounds and uses a separate model evaluation of the accepted instance for volume and centroid. The two complete runs freeze the same 759 source files, and only LibraryPanel.tsx differs between their source maps. [Commands and receipts](qualification.json).

- **PASS** — fixed desktop Insert, Place, identical name and version with a new-only variant, first Undo and Redo, local Save and fresh Open, the focused library tests, and both type checks.
- **FAIL** — original Insert and Place silently select and store A. The first browser attempt also stopped at an optional bounds field in the test oracle. The corrected driver reproduces both defects on the original product source.
- **NOT_RUN** — first launch timed out at the load gate before starting Chrome. Full kernel, mobile, forced stale-click races, pending file reads across document or panel changes, and team or browser store write-failure cases were not run. The proof is for the active local panel after file load.

[#2361](https://github.com/barocss/barocss/issues/2361) remains open for the remaining acceptance cases. Next is D573, P0 rows 12 and 16. Check whether unsaved Variants values from document A appear after opening document B for [#2362](https://github.com/barocss/barocss/issues/2362). Whole CAD remains NOT_MEASURED.
