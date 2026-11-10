---
work_id: D616
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D616 — Derive a local worker plan from a saved native model

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification of the planned entry to the existing local two-task run.

Run from `apps/cad-studio`. Select two occurrence IDs in the saved model.

```sh
node scripts/cad-cli.mjs task-run plan housing.bcad p1 p2 > plan.json
node scripts/cad-cli.mjs task-run start run --plan plan.json
```

The JSON shows the two feature scopes, stated requirement IDs, current heights, nominal targets, tolerances, local worker limits and source identities. Each selected occurrence must have one stated hard equality for the local Z bounding-box height in millimetres. The nominal value must satisfy the other hard height checks and differ from the current extrusion height. The existing typed plan checks the remaining geometry scope and design inputs. This entry accepts native model bytes in `.bcad` or `.json` files within 16 MiB. The plan file limit is 128 KiB.

The start command checks the exact source bytes, rederives the plan and compares its complete content before creating the run. Both initial workers receive the rederived values and the same decoded source snapshot. They produce pending candidates. The terminal operator still decides whether to publish. The existing manual config and retry commands retain their authority and scope.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The exact browser-project Save produced a plan for `p1/n1` at 5 → 6 mm and `p2/n1` at 3 → 4 mm. Both targets came from the saved `height` checks with 0.001 mm tolerance. |
| K02 | PASS | A whitespace-only source change was refused before the run directory existed. Focused tests also refuse changed plan fields, missing or ambiguous targets, an incompatible secondary height limit and a target that needs no edit. |
| K03 | PASS | Both actual local workers reached decision. Studio previewed both planned changes. The first approval invalidated the old second attempt. Refresh, exact terminal approval, native checkpoint Open and editable project Save and reopen passed. The original browser-project file and the run's accepted history retained their bytes. |
| K04 | PASS | Independent ZIP/XML readback of the reopened working model measured placed volumes of 1,200 and 480 mm³. Studio kept the historical 4 mm Lid approval separate from its 5 mm working failure. |
| K05 | PASS | A packed native source retained the inactive mesh proposal through planning, real worker dispatch and host reopen. The recovered native export matched the original bytes. Independent review cleared the source after the bounded file readers returned plain byte arrays. |

The first focused test failed to bundle because the new test misspelled the Model import. The corrected suite passes. Source review identified a Node Buffer slice problem in both the new source read and the existing run reopen. The final tests cover the corrected packed-file path. [Commands and hashes](qualification.json).

The qualified path covers the two selected extrusion-height tasks. Active packed mesh evaluation, live AI providers, other task families, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
