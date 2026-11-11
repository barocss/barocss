---
work_id: D642
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D642 — Stop a reopened CAD run and keep approved work

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

Studio offers **Stop local run** on a reopened active run. The request identifies the run, revision and accepted model. The local host checks the exact revision and accepted digest before it acquires the writer. The existing Stop transition cancels unfinished tasks and keeps the accepted model and approval history.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Studio reopens the active run with p1 approved and p2 awaiting a decision. Stop returns 409 while a real terminal process owns the run. The record and directory entries stay unchanged. |
| K02 | PASS | After the terminal releases its writer, Stop refuses an older revision before it creates a writer record. Stop from the current card succeeds. One new writer epoch records recovery and Stop. |
| K03 | PASS | p1 stays completed and p2 becomes cancelled. One Stop is recorded. Repeat Stop and a later terminal attempt to approve p2 leave the stopped record unchanged. The chat card omits the local path. |
| K04 | PASS | A fresh desktop Studio session reopens the same stopped run and keeps a separate working model until explicit checkpoint Open. The opened bytes match the earlier approved model. An independent byte reader confirms the preserved single commit and heights of 6 and 3 mm. |
| K05 | PASS | The existing live Stop and stopped-native-finding flows pass. Focused Studio tests, both type checks, changed TypeScript lint and the Studio build pass. |

[Commands and hashes](qualification.json). The first type check rejected the synchronous evaluator callback. The first desktop check missed the terminal prompt because the Python helper buffered it. The first independent reader used the wrong field name for the commit target. The final checks use the asynchronous evaluator contract, an unbuffered terminal helper and the stored commit target. Forced writer exit, live providers, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
