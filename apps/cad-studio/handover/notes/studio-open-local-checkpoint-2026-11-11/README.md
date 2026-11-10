---
work_id: D622
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D622 — Open a terminal-approved checkpoint from the Studio run card

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

After terminal approval, refresh the local run and choose **Open approved checkpoint**. Studio opens the approved model as a detached working document and shows the before and after requirement results in Project & versions. The local run and original project file remain unchanged by Open.

The card identifies the latest terminal-approved task by run key, run ID, task, approval operation and accepted native SHA-256. The loopback request has a 1 KiB limit and uses the existing Origin, Host and explicit intent guards. The service uses the owned run directory, projects the selected approval from a single durable record and verifies the immutable native files without taking a writer lease. The binary response uses the existing portable checkpoint format. Studio checks the response size, both original native files, the candidate, the approval and the scoped native requirements. It verifies the selection again before it adopts the document. An intervening Open, document dispatch or Worker restart retires the older attempt.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Actual Studio opens both terminal approvals directly from the same run card. First Open gives 6/3 mm. The rebuilt sibling remains reviewable. Final Open gives 6/4 mm and the p2 requirement changes from Fail · 3 mm to Pass · 4 mm. |
| K02 | PASS | A corrupted successful response is refused. A delayed valid response cannot overwrite the model opened later at 7/3 mm. A second terminal approval retires the previously selected checkpoint during Open. The earlier pin also returns HTTP 409 on a fresh request. |
| K03 | PASS | The independent reader parses both captured HTTP responses, hashes their native segments and compares them with the immutable objects, terminal commits and opened Studio documents. The responses are 10,767 and 15,323 bytes in the recorded fixture. |
| K04 | PASS | The two direct Opens require zero manual checkpoint exports and zero browser downloads. The source project bytes, durable record and writer files stay unchanged across the tested read operations. |
| K05 | PASS | Focused tests and isolated overlays cover request identity, current approval and bounded binary transport. The existing D621 desktop flow still opens portable checkpoints through file selection. |

The direct action is scoped to the newest approved task checkpoint of the owned run. Terminal approval, rejection and rebuild retain their existing controls. [Commands and hashes](qualification.json).

Whole suites, live providers, mobile, other task profiles and restoration across chat sessions are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
