---
work_id: D640
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D640 — Show local CAD runs while initial workers are active

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

Studio displays the run after the local host verifies and records the exact saved model. The card reads current task status while Start is still in progress. A matching concurrent Start follows the same host. The chat card displays task state without rendering the local folder path. The terminal approval step still controls publication.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio displayed the active card and both running tasks before the initial Start finished. Revision 0 recorded the baseline before dispatch. Revision 2 showed both tasks running. The accepted native file matched the saved model byte for byte. |
| K02 | PASS | A second Start returned the same run identity with the reuse flag. Two native worker threads entered in one process, with one run directory and zero publications. The card omitted the local path. |
| K03 | PASS | After the test released the workers, both candidates awaited a decision at revision 6. Studio reviewed p1 at 5 to 6 mm. A single explicit terminal approval produced revision 9. Studio opened its exact checkpoint at 6 and 3 mm. |
| K04 | PASS | An independent byte reader checked the record, worker markers, state transitions and publication. Desktop stopped-run and replacement-provenance regressions passed. |
| K05 | PASS | Focused model and Studio suites, both type checks, changed TypeScript lint and the Studio build passed. |

The test held the real worker threads at entry until Studio displayed their running state. The workers then computed their native candidates. The first desktop check failed because the dev proxy waited for a response body before forwarding admission. The final check passed after the server sent a JSON whitespace chunk. The first Studio type check rejected the promise helper under the existing compiler target. The final type check passed with an ordinary promise.

[Commands and hashes](qualification.json). In-flight Stop, forced runner exit after admission, live providers, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
