---
work_id: D626
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D626 — Check the working occurrence against an approved task

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

The approval history card can evaluate the selected occurrence in the current working document. The working result has its own evidence revision. Studio matches the recorded acceptance, occurrence, feature and definition or pattern identity before it checks the working model. Changed criteria are labeled separately. Each check belongs to the exact working document dispatch, Open intent, Worker session and selected approval.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio shows the original failure at 3 mm, the approved pass at 5 mm and the working pass at 5 mm. With a later 7 mm extrusion it keeps the approved pass and shows the working failure. |
| K02 | PASS | A new 7 mm criterion displays Requirement changed. An unrelated document with the same occurrence key shows the approved occurrence as unavailable. Both retain the historical results. |
| K03 | PASS | The driver holds two real Worker responses, then edits the working document or opens a replacement. It delivers each response after the change and verifies that the old result stays hidden. A fresh check after the edit returns the current failure. |
| K04 | PASS | The independent reader confirms the source values and recomputes the three evidence revision hashes. The three-task history path, existing two-task path and earlier height-only checkpoint open in Studio. |
| K05 | PASS | Focused Model and Studio tests, type checks, lint and the Studio build pass. |

The fixture uses one top-level prismatic occurrence and its authored height check. [Commands and hashes](qualification.json).

Whole suites, mobile, live providers, nested occurrences and persistent occurrence identity across arbitrary external file edits are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
