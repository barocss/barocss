---
work_id: D566
artifact_type: body-clipboard-history-branch-ownership
status: qualified-for-the-reproduced-history-branch
last_updated: 2026-11-10
---

# D566 — Prevent clipboard rebinding when an Undo branch reuses an ID

P0, rows 12 and 16. The parent is `db328bd4386c1695841394d358d9704013815271`. This covers the same-document history branch in [#2310](https://github.com/barocss/barocss/issues/2310), after [D565 deleted-source coverage](../body-clipboard-deleted-source-2026-11-10/README.md).

## Reproduction

Create a 10 mm cube in an empty Studio document and Copy b1. Undo the creation and Redo it. The same b1 returns and Paste works at X +20 mm without another Copy. Undo the Paste and then the original creation. Studio is back at the exact empty document. Create a different 8 × 9 × 11 mm box. The new edit discards the former Redo branch and reuses b1.

The old clipboard pasted a duplicate of the 792 mm³ replacement at X +36 mm. The first Undo removed this unintended duplicate. The reproduction harness passed and the product result was FAIL.

## Repair and actual verification

The clipboard records its producing feature ID from the evaluated document behind the copied body. On accepted edit, if the copied key has no current output, its producer is absent from the accepted document, and the candidate introduces that producer ID, Studio clears the clipboard. Normal Undo and Redo still restore their existing history documents and retain the clipboard within the same source history.

In the fixed run, normal Redo again permits the original +20 mm Paste. After the branch reuses b1, stale Paste preserves the exact replacement document, one evaluated body, selection, history, file name and dirty state. The first Undo now removes the replacement box, and Redo restores it. An explicit new Copy allows Paste at X +18 mm. The replacement and fresh duplicate have centroids [4, 4.5, 5.5] and [22, 4.5, 5.5] mm. The D565 deletion driver also passes on the fixed source, including the +44 mm Paste after Undo restores the original b1.

Root reviewed the stale Paste before and after the fix. The earlier Copy notice remained visible in both captures. Each run completed four independent box checks at 1e-9 absolute tolerance. The reproduction and fixed runs use the same driver with only App.tsx differing in the source pins. Commands, counts, hashes and cleanup are in [qualification](qualification.json).

- **PASS** — reproduction harness, fixed branch case, normal Redo and D565 deletion regression, driver and helper syntax, 13 ownership tests, final Model and Studio types, and cleanup.
- **FAIL** — the original product duplicated the replacement body at X +36 mm.
- **NOT_RUN** — other body producers and history branches, full kernel and mobile.

Next is D567, P0 rows 12 and 16. Check same-key clipboard isolation across browser project autosave Restore. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
