---
work_id: D610
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D610 — Trace a saved requirement regression after approval

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification for the optional `later` argument to `history.approval_evidence`. The original two-version call remains available. When supplied, all three pins must identify consecutive saved versions on the same branch without a merge. Each document must pass the existing version, snapshot and revision checks. The report retains the original failed check and verified approval, then includes the follow-up version and finding for each recovered requirement.

The report matches the authored later snapshot against an edit of the approved parameter or leaf requirements. This includes the enclosing definition revisions and placement. A missing, changed or unsupported occurrence gives an unresolved result when the edit cannot reproduce the later state. A changed or withdrawn requirement gets a distinct finding. An unchanged requirement can pass or regress only on a current successful evaluation of the later version. The report is computed on demand from saved evidence. Snapshot equivalence establishes authored state within the supported edit family. It gives no record of operations performed between saves.

| Group | Result | Evidence |
| --- | --- | --- |
| L01 | PASS | Desktop Studio, the local chat server and stdio MCP returned 6 mm fail, 4 mm approved pass and 8 mm later fail on `p1/p1`, with a 5 mm limit. A separate working report passed at 4 mm after Studio restored the approved version. The independent fixture oracle checked six heights across both leaves in the three authored snapshots. |
| L02 | PASS | The first turn requested all three IDs. The next turn returned the three pins and an exact copy of the original two-version report plus the follow-up. An alias and reversed lineage were refused. The project document, log and all saved snapshot bytes were unchanged. |
| L03 | PASS | Focused tests cover changed and withdrawn criteria, a different branch, a skipped or corrupt version, a missing or replaced occurrence, unsupported edits, and an unavailable or rejected evaluation. A self-consistent hash cannot admit invalid parent or branch data. The valid later-pass control evaluates a new 3 mm version. |

The controlled driver stages the original native D607 files and a parameter-only later file, then uses Studio to create the versions, reload the project, restore the approved version and send the local chat requests. The read itself uses the real product path. The driver uses a scripted local caller and does not use a live model.

Initial review found that array-like parent fields could satisfy the lineage guard and a thrown follow-up evaluation could suppress valid historical proof. The final guard verifies the selected version records, parent arrays and index order. The later evaluator returns unresolved on failure and preserves the historical result. Code review approved the final diff and the architecture review was clear. The regression overlays exercise these controls.

See [commands and hashes](qualification.json). Arbitrary cross-version occurrence or face identity, successful tracing through merges or skipped versions, a persistent defect ledger, worker checkpoint intake, live providers, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
