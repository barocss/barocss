---
work_id: D630
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D630 — Open the exact native model from a reopened run

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

The reopened run card provides Open run baseline. The local service reads the accepted native file from one checked run record and checks the requested run identity and model digest. Studio verifies the response checksum, decodes and re-encodes the same native model, and checks the current run again before adoption. The working document remains open through these checks.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | A fresh Studio session opens the baseline and reviews the held 5 → 6 mm candidate. The original standalone model file is absent from its prior path and is never opened by Studio. |
| K02 | PASS | A damaged response fails checksum verification and preserves the working edit and Undo. A held valid response leaves a newer file Open intact. |
| K03 | PASS | A terminal publication during a held read retires the old baseline. Studio preserves the working model, refreshes the card and opens the newly accepted 6 mm and retained 3 mm parts. |
| K04 | PASS | Baseline reads issue no Start request and change no durable run entries. The independent reader compares both source and accepted bytes with the native files and Studio documents. The focused test also refuses a wrong run ID, wrong digest and extra path field. |
| K05 | PASS | The reopened-run and earlier two-task checkpoint paths pass in Studio. Focused tests, type checks, lint and the Studio build pass. |

[Commands and hashes](qualification.json). Whole suites, mobile, live providers and baseline transfer between computers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
