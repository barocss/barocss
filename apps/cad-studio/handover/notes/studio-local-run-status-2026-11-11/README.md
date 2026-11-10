---
work_id: D621
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D621 — Refresh the same local worker run in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Choose **Refresh status** on a started local run. Studio reads the current task states and review pins for that run. Cards in the same chat share the newest observed revision. A refresh closes a preview if the new status retires its candidate. A review response that arrives later must agree with the observed status before Studio displays it.

The loopback request carries the run key and run ID. It has a 1 KiB limit and uses the same Origin, Host and explicit intent checks as the other local run routes. The service verifies the owned directory and accepted native reference, then projects status and pins from one durable record. The read does not acquire a writer lease or resend the source. The terminal operator still owns decisions and the worker rebuild. Studio opens the approved checkpoint through its existing verified file intake.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | After terminal approval of p1, an explicit status read moves both cards to p1 completed and p2 stale. A late HTTP 200 from the older revision does not restore the old status or tint. |
| K02 | PASS | Studio opens the approved baseline at 6/3 mm. The terminal rebuilds p2 and Studio refresh finds a new attempt and candidate digest. The previous pin returns 409 against the new baseline. Preview changes only p2, giving 6/4 mm and +96 mm³ for the lid. |
| K03 | PASS | A second terminal approval retires an already fetched but delayed review response. The final status shows both tasks completed, and the final checkpoint opens at 6/4 mm. Independent arithmetic gives 1,200 and 384 mm³ from the two profiles. |
| K04 | PASS | Actual status reads each send 137 bytes of identifiers. No new start or model upload follows launch. Run files, accepted native bytes and the saved project source remain byte-identical across the tested reads. |
| K05 | PASS | Focused tests and mutation overlays cover the request bounds, owned run and response checks. The existing D620 Studio review flow passes again. |

The first desktop run found that shared status could overwrite a card's launch label. The final cache stores only status fields, and the rerun shows the correct **Existing local run** label. [Commands and hashes](qualification.json).

Refresh is explicit and scoped to the current chat session. New sessions do not restore the previous run cards. Whole suites, live providers, mobile and other task profiles are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
