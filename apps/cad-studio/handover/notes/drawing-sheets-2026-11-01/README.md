# D398 — Row 11 ④: drawing sets, several sheets (CG5 DR-8)

Tier: **full** (drawing schema and public API): two audit rounds with mutation and a merge fuzz, a root re-check of the weld finding, and one actual run. [Qualification](qualification.json).

## What it adds

**Sheets and views**
- A drawing can now have more than one sheet. Use the **+** tab under the paper to add one.
- Move any view to another sheet with the Sheets panel's "Move … to sheet" selectors.
- Each sheet has its own size and scale.
- A view's annotations go with it.

**On each sheet**
- Every sheet's title block says "n OF N".
- Sheet 1 holds the sheet index, the revision table and the tables.
- A detail or section on another sheet carries "SEE SHEET n" at its callout and "FROM SHEET m" under its label. This was deferred since DR-1.

**Checks**
- Drawing-wide checks (datums, coverage, breaks, weld visibility) are judged on the whole set.
- Placement checks are judged per sheet.
- Each weld symbol goes on the sheet of the view that shows its joint, exactly as on one sheet.

**Exports and records**
- Export PDF writes every sheet in one file, one page each at its own size.
- SVG and DXF write the sheet you are looking at.
- Revisions can carry an ECO number.

**Unchanged**
- A drawing without sheets exports byte-identically to before.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md))

**Round 1** found two high-severity defects:
- weld symbols vanished, and the balloon/weld flags were lost;
- a false datum error appeared across sheets.

It also found two medium ones:
- chat ignored the sheets;
- a deleted sheet's notes came back.

All were fixed. A merge fuzz of 3000 random edits never lost another sheet's items.

**Round 2** found weld symbols silently lost for a joint seen only on another sheet. That was fixed, and the root confirmed it with the auditor's own probe.

## Actual run

[run03](run03/receipt.json) on `bracket.bcad`:
- Added sheet 2 and moved the top view onto it.
- Exported both [sheet 1](run03/03-sheet1.svg) and [sheet 2](run03/02-sheet2.svg) as SVG, and the set as a two-page A4 PDF.
- Ran Undo/Redo, then Save and a fresh Open.
