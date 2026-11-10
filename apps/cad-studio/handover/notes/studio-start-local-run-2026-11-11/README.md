---
work_id: D619
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D619 — Start a verified local worker run in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Save the model in a browser project on local Studio. Inspect the two supported extrusion-height occurrences with `requirements.plan_tasks`, expand the ready tool row and choose **Start local run**. The row shows the outcome, the status of both candidates and the run directory. **Export task run** remains available for a file-based handoff.

Studio sends the verified handoff after it checks the current document, accepted project file and exact saved bytes. The start route requires the same allowlisted loopback Origin and Host, an explicit intent header and a binary handoff within the existing size limit. The service starts a separate local Node process. It checks the embedded source and rederives the plan before it creates any run directory. Each invocation has its own native blob store.

The service owns the destination under `~/.barocss/cad-task-runs` by default. The operator can set `CAD_STUDIO_TASK_RUN_DIR` at server startup. The exact source SHA-256 and unordered occurrence pair select one private run directory. A repeated start reads the existing record. If the directory has no record yet, the existing writer protocol controls the retry. The service accepts one start at a time and uses the same two-worker profile as the CLI, with three attempts per task and a 10-second worker limit. This limit applies to worker eligibility. Synchronous native replay in the separate process can take longer. The terminal still owns publication.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio starts the exact saved handoff by explicit click. The two candidates are held at 1,200 and 384 mm³ with zero commits and the original accepted hash. |
| K02 | PASS | Repeated and reversed selections return the same run and leave its record byte-identical. A private directory with an earlier released writer and no run record starts at epoch 2. |
| K03 | PASS | Studio refuses a changed final read with the same storage tag and an identical model opened as another file. Both refusals send zero start requests. The blocked plan has no start action. The service rejects tampered native bytes before it creates the destination. |
| K04 | PASS | The terminal operator approves the exact reviewed p1 candidate. Actual Studio opens the approved checkpoint, shows Fail · 5 mm and Pass · 6 mm, and retains the original saved model. |
| K05 | PASS | Focused HTTP tests and independent source reviews cover Origin, Host, intent, type and size refusal and the single writer boundary. Isolated overlays verify the HTTP assertions. |

The browser test uses a scripted local chat turn, the real Studio UI, the actual local service, two real workers and the terminal approval path. An independent Python check reads the authored requirements directly and verifies the target heights and scope. [Commands and hashes](qualification.json).

Full suites, live model behavior, remote launch, additional task families and mobile are **NOT_RUN**. B09 remains 9/9 within its ledger. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
