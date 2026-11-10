---
work_id: D573
artifact_type: variant-document-draft-qualification
status: fixed-and-qualified-for-selected-desktop-document-boundaries
last_updated: 2026-11-10
---

# D573 — Keep unsaved Variants inputs with their document

P0, rows 12 and 16. This is the native Open and ordinary Variants path of [#2362](https://github.com/barocss/barocss/issues/2362). Use the SMALL tier for the private Studio repair.

## Actual Studio

Open A and edit its Master input `size` to 40 mm without saving. Then use the public Open button to open B, which has the same file name and input name but a different parameter binding and a 10 mm Master value. Before the fix, with the panel open or closed, B's first evaluation request carries 40 mm and the resulting box has volume 2,000 mm³. B's stored master still holds 10 mm. The banner shows an edited Master and says modelling waits until the Master is shown.

The fix scopes the working draft to one accepted document context. App clears it in the same accepted replacement action and on history entries that cross that boundary. Setters from an earlier context cannot reapply the draft. Ordinary edits retain their existing draft and active-value behavior.

After the fix, the first B request carries 10 mm and B displays a 500 mm³ box with the Master shown. The run checks direct Open with the panel open and Open through an intermediate document with no inputs after closing the panel. The passive observer records actual outgoing evaluation requests. It does not change the requests. Independent box arithmetic checks Worker result volume and centroid to 1e-9 mm³ and mm respectively. Root reviewed the two direct-open captures.

Within B, the 16 mm unsaved preview leaves the master exact and survives a malformed Open and a trusted Chromium file-input cancel. Reset restores 10 mm. Save variant writes the 18 mm Tall value without changing the master, and first Undo and Redo restore the exact documents. Update Tall writes 22 mm, and Show Master and Show Tall alternate between 10 and 22 mm. Undo and Redo across Open discard drafts on both sides. The fixed run records 18 independent physical checks. [Commands and receipts](qualification.json).

- **PASS** — selected desktop replacement and history paths, first B Worker inputs, same-document Variants controls, malformed and cancelled Open preservation, focused tests and both type checks.
- **FAIL** — original Studio applies the 40 mm draft to B on both direct Open paths.
- **NOT_RUN** — active named variant already stored in an incoming file, other input types, standalone New, template, project, version, recovery and edit-in-place browser paths, fresh reopen of a saved variant, STEP/3MF, full kernel and mobile. Source inspection confirms the existing replacement callbacks for New, template, project, version, recovery and edit in place use the shared boundary.

[#2362](https://github.com/barocss/barocss/issues/2362) remains open for its other acceptance cases. Next is D574, P0 rows 09 and 16. Check whether a delayed Finish response can apply after editing or cancelling an ordinary sketch for [#2364](https://github.com/barocss/barocss/issues/2364). Whole CAD remains NOT_MEASURED.
