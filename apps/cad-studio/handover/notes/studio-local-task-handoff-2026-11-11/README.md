---
work_id: D618
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D618 — Export the exact Studio task run handoff

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Save the native model in a Studio project, then inspect the two selected occurrences with `requirements.plan_tasks`. Open the ready tool row to see the current and planned heights. Choose **Export task run** to create one `.bcad-task` file. It contains the original native bytes, exact model revision, occurrence IDs, requirement IDs, target values and a source SHA-256.

Run from `apps/cad-studio`.

```sh
node scripts/cad-cli.mjs task-run start run --handoff housing.bcad-task
```

Studio binds the offer to the project file accepted by Open or Save at turn start. Export checks the current document, project owner, file tag and byte hash. It reads the file again after encoding and before emitting the artifact. The source limit is 16 MiB. The CLI checks the envelope and embedded source, then rederives the plan and compares its targets before creating a run. A portable handoff carries its own saved snapshot. The existing terminal decision still controls publication. The accepted run store uses its normal native encoding, so its file hash can differ when an equivalent source had different formatting.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Actual Studio chat shows the two reviewed heights, 5 → 6 mm and 3 → 4 mm. A user click emits the handoff. The captured bytes contain the exact browser project source and both original target records. |
| K02 | PASS | The browser rejects export after a byte-identical document is opened as another file. It also rejects a controlled second read with one changed whitespace byte while keeping the same storage tag. Both refusals leave the original artifact and source intact. A blocked tool result has no export action. |
| K03 | PASS | Explicit CLI start produces two awaiting-decision candidates with evaluated volumes of 1,200 and 384 mm³. The product uses the existing worker and terminal decision paths. Studio opens the first approved checkpoint and shows Fail · 5 mm and Pass · 6 mm. |
| K04 | PASS | Focused tests refuse a changed payload, rechecksummed altered target, stale model revision and unresolved requirement. Both CLI input refusals leave the run directory absent. Transport tests distinguish a ready owned offer from failed or unowned results. |
| K05 | PASS | Independent source reviews found that size and timestamp cannot bind native bytes. The final source pins SHA-256 at accepted Open or Save and compares it on both export reads. |

The desktop driver captures the handoff at the browser's export boundary before Chrome writes a download. The independent Python check reads the fixture requirements directly and verifies the target values and scopes. The handoff's native payload is compared byte for byte with the saved project file. [Commands and hashes](qualification.json).

Direct Studio launch, live model behavior, other task families, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
