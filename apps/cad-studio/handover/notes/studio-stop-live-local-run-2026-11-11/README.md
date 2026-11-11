---
work_id: D641
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D641 — Stop a local CAD run from Studio while workers are active

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

The live run card offers **Stop local run** during the initial Start. Studio sends only the run key and ID. The chat server forwards Stop through the private child process channel to the writer that admitted that exact run. The writer records the existing Stop transition before it aborts the workers. Studio displays the stopped state when the same run returns it.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio shows p1 and p2 running and p3 ready. Stop records revision 3 under the original writer epoch. The worker threads exit before the test releases their entry barrier. p3 has zero attempts. |
| K02 | PASS | Both in-flight operations are interrupted and all three tasks are cancelled. One Stop operation is recorded. Used budget is zero, unknown usage is four, and no model or candidate is published. The focused host test also rejects a worker reply delivered after Stop. |
| K03 | PASS | A mismatched run ID and an added directory field are refused. A repeat Stop returns the same stopped status without changing the record. The Studio card omits the local directory. |
| K04 | PASS | A fresh desktop Studio session opens the same stopped run and preserves a separate working model. Explicit baseline Open returns the exact saved native bytes with original heights of 5, 3 and 3 mm. An independent reader verifies the worker, writer, operation and file records. |
| K05 | PASS | The existing live Start and stopped-native-finding flows pass in desktop Studio. Focused Studio tests, both type checks, changed TypeScript lint and the Studio build pass. |

The Stop fixture uses real worker threads held at entry. Interruption inside the geometry evaluator remains unmeasured. The initial Start writer owns this Studio control. Stop after that writer has exited remains available through the terminal.

[Commands and hashes](qualification.json). Stop during kernel evaluation, Stop from a reopened active card, forced runner exit, live providers, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
