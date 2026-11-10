---
work_id: D574
artifact_type: sketch-finish-ownership-qualification
status: fixed-and-qualified-for-ordinary-reopened-sketch
last_updated: 2026-11-10
---

# D574 — Discard a Finish response from an expired sketch edit

P0, rows 09 and 16. Use the SMALL tier for the private Studio repair in [#2364](https://github.com/barocss/barocss/issues/2364).

## Actual Studio

Open a 40 × 20 mm rectangle with a 10 mm Extrude. Reopen the rectangle from the Extrude editor, set its first edge to 50 mm and click Finish. The test holds the unchanged successful Worker response for that exact request. In one browser context, Escape closes the sketch before the response is delivered. In another, editing the same edge to 60 mm supersedes the 50 mm request before delivery.

Before the fix, both responses commit 50 mm and change the Undo target. The second response also closes the 60 mm draft. Each resulting body is 10,000 mm³. A separate controlled run of the actual hook reproduces four cases with late success and failure replies after cancel or resize. The current refusal and retry control passes on the original code.

The fix applies the existing document and sketch generation check to ordinary reopen Finish responses before the commit or notice. A sketch state dispatch invalidates the older request, including cancellation, geometry or constraint edits, and UI-only changes to tool, picks or the active dimension field. The linked and detached paths already use this guard. The evaluation inputs, document commit and ordinary new-sketch path stay as before.

After the fix, both stale successes leave the exact 40 mm document and 8,000 mm³ solid. The first leaves the panel closed. The second keeps the 60 mm draft open. History, selection, dirty state and notices match the state immediately before delivery. Finishing the live 60 mm draft commits 12,000 mm³. First Undo restores the exact 40 mm document and first Redo restores 60 mm. Both the cancelled 40 mm document and the completed 60 mm document survive local browser project Save and public Open in a fresh context. Root reviewed the actual 60 mm draft capture after delivery of the stale 50 mm response.

Independent Python checks use literal width, depth and height, accepted sketch coordinates, and the actual Worker volume with absolute tolerance 1e-9. There are two checks on the original and seven on the fixed flow. [Commands and receipts](qualification.json).

- **PASS** — fixed desktop cancel, superseding edit, current Finish, Undo/Redo and two native Save/fresh Open cases. Both type checks and the focused identity and guard tests pass.
- **FAIL** — original desktop applies both stale successes. The controlled hook tests also expose the two late failures on the original.
- **NOT_RUN** — desktop injection of an error response, separate linked and association-detached desktop flows, mode switches during pending Finish, repeated Finish with reverse delivery, full kernel and mobile.

[#2364](https://github.com/barocss/barocss/issues/2364) remains open for remaining acceptance. Next is D575, P0 rows 10 and 16. Check whether stale BOM rows can apply a buy/make override to the current document while a fresh result is pending for [#2356](https://github.com/barocss/barocss/issues/2356). Whole CAD remains NOT_MEASURED.
