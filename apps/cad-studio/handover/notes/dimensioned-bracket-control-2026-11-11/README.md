---
work_id: D597
artifact_type: bounded-product-qualification
status: controlled-pass
last_updated: 2026-11-11
---

# D597 — Qualify the offline dimensioned bracket control

P0 automation, B09 follow-up, rows 04, 07, 12 and 16. Use one [authored two-view drawing](../../../test/fixtures/dimensioned-angle-bracket.svg), D597 Rev A. A human transcribed the dimensions into typed calls. The driver uses the real local MCP process and the desktop Studio. This is the control for a later model interpretation experiment.

## Result

| Group | Result | Observed evidence |
| --- | --- | --- |
| G01 | PASS | MCP starts from an empty native part. It creates two fully constrained rectangles, two extrusions, one Union and one through bore. The deliberate Ø8 produces four passing requirements and one hard failure. The bore requirement measures 8 mm against 6 mm. |
| G02 | PASS | An invalid edit in the second operation of a batch rejects the first operation as well. The native file is byte-identical after refusal. One bore edit keeps the body key and changes the diameter to 6 mm. All five requirements pass. The authoring pass uses 9 of 14 allowed tool calls and one repair. |
| G03 | PASS | Three native reads each show one closed solid and pass the strict B-rep check. An independent Python calculation checks the volume and centroid against the analytic bracket and bore. It also checks the dimensions, two 0-DOF rectangles, and the inward cylinder at x28, y10 with axis parallel to Z. The observed volumes are 4598.938070170254, 4686.90266447077 and 4846.90266447077 mm³. The comparison uses an absolute tolerance of 1e-8 in each measured quantity's unit. |
| G04 | PASS | Desktop Studio opens the corrected part, edits H from 24 to 26 mm and shows the height failure. First Undo returns the exact corrected document. Redo returns the exact edited document. Studio saves to a browser project and opens the exact saved bytes in a fresh browser context. The native feature list remains unchanged. A fresh read-only MCP report on the saved file passes four requirements and fails height alone. |

The original bore mismatch is an intentional negative case. No unexpected failure occurred. The reopened desktop view showed one editable solid, a through bore and the failed height requirement. The control uses a strict test tolerance. The drawing carries no manufacturing tolerance specification.

The targeted Studio checks passed 11/11, the targeted Model checks passed 34/34 and both TypeScript checks passed on Node 22.19.0. The desktop source manifest retained 771 matching hashes before the run, after the run and after cleanup. See [qualification commands and hashes](qualification.json).

## Boundary

Live image interpretation, provider comparisons, multi-worker delivery, whole-browser and whole-kernel suites, and mobile are **NOT_RUN**. B09 v1 remains 9/9 scoped groups. Four of ten initial product scenarios have an accepted ledger. Whole-CAD and core readiness remain **NOT_MEASURED**. This control supplies partial evidence for the open AI workflow issues [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402).
