---
work_id: D643
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D643 — Approve the reviewed worker candidate in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

The local candidate preview offers **Approve candidate** after Studio verifies the exact native baseline and checks the candidate. The approval request binds the run, attempt, candidate, accepted model, complete review receipt and control revision. The local host checks the receipt before it takes the writer and again during writer acquisition. The existing user decision and native checks control publication. Studio updates the run card and keeps the working model until an explicit checkpoint Open.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio reviews both candidates. The approval control is disabled while the accepted model is shown. The run record and working model stay unchanged through review. |
| K02 | PASS | A wrong receipt digest and a wrong control revision each return 409 without adding writer files or changing the record. |
| K03 | PASS | One explicit Studio approval publishes p1. The chat card shows p1 completed, retires p2 and offers the approved checkpoint without a refresh. The retired p2 approval is refused and repeat p1 approval reuses the single commit. |
| K04 | PASS | A fresh Studio session opens the approved native bytes. An independent reader ties the request to one durable approval, checks the source and accepted byte hashes and derives rectangle volumes of 1,200 and 288 mm³ from the authored dimensions. The sibling is unchanged. |
| K05 | PASS | The existing Studio review, terminal approval and reopened Stop flows, focused Studio tests, both type checks, changed TypeScript lint and the Studio build pass. |

The first review regression found a changed error for a malformed receipt. The final check preserves the existing receipt error and validates approval metadata after receipt decoding.

[Commands and hashes](qualification.json). End-to-end delivery of both tasks from Studio, live providers, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
