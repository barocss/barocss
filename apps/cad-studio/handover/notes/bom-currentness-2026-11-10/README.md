---
work_id: D575
artifact_type: bom-currentness-qualification
status: fixed-and-qualified-for-the-ordinary-desktop-pending-result
last_updated: 2026-11-10
---

# D575 — Require the current BOM for row actions and CSV

P0, rows 10 and 16. Use the SMALL tier for the private Studio repair in [#2356](https://github.com/barocss/barocss/issues/2356).

## Actual Studio

Open ordinary shaft A with diameter 10 mm and length 20 mm. Show its bought row in BOM. Open ordinary shaft B with diameter 12 mm and length 25 mm in the same tab, while leaving the panel mounted. Both shafts use feature ID `n0`. Hold the unchanged real Worker response for the current B BOM request.

Before the fix, the panel displays A. Clicking Export prepares a Blob named `D575-B purchase list.csv` whose shaft and part rows still describe A. Choosing Made on A's row writes `bought: false` on B's shaft. First Undo restores B without an override. The first driver had already observed both defects when an assertion about the Undo tooltip stopped it. That tooltip has the same text for both actions. The corrected driver checks the actual first Undo.

After the fix, pending B displays a working status and a disabled Export button. The previous rows and selectors are absent. The blocked action produces no CSV Blob and leaves the exact document, history, dirty state and selection. Once the held response arrives, the B row is available. The B purchase list includes the 12 mm shaft and the B part with With made parts on. With made parts off, an unmarked shaft is excluded. Choosing Bought on B changes only `n0`; first Undo and Redo restore the exact documents. Export then includes one bought B shaft, quantity one, with the expected nine columns. The driver captures CSV bytes at the Blob and anchor boundary and suppresses browser downloads. An independent Python CSV reader checks two original and three fixed outputs.

The panel renders only a successful result for the current document and name. Pending and refused requests do not relabel previous data. CSV and row handlers also compare their key with the current mounted key. Layout cleanup revokes that key on close. The controlled recorder checks ordinary document and name changes, current rejection and recovery, retained old handlers, and late replies after unmount. Existing Model partial-result policy and linked housing evaluation remain in their Model paths. Root reviewed the before and after pending-state captures. [Commands and receipts](qualification.json).

- **PASS** — fixed desktop pending block, current CSV and bought override, first Undo and Redo, linked/nested Studio recorder tests, Model BOM tests, both type checks and Studio build.
- **FAIL** — original desktop prepares A's rows under B's file name and lets A's row edit B. Five new recorder cases also fail on the original source.
- **NOT_RUN** — a live desktop rejection from the BOM producer, saved CSV file readback, a nested/linked desktop replay in this milestone, native project Save and fresh Open, full kernel and mobile.

[#2356](https://github.com/barocss/barocss/issues/2356) remains open for remaining acceptance. Next is D576, P0 rows 11 and 16. Check whether a delayed drawing action reports success after Studio refuses its settings commit for [#2359](https://github.com/barocss/barocss/issues/2359). Whole CAD remains NOT_MEASURED.
