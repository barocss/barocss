---
work_id: D602
artifact_type: bounded-product-qualification
status: current-boundary-verified-with-accuracy-finding
last_updated: 2026-11-11
---

# D602 — Qualify the nested requirement scope boundary

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. The earlier next-item text named row 09. Row 10 owns subassemblies and occurrence paths. Freeze two visible nested plate occurrences whose leaf ID is p1 in both parent documents. The root paths are p1/p1 and p2/p1.

| Group | Result | Evidence |
| --- | --- | --- |
| N01 | PASS | Real MCP assembly discovery lists the two distinct paths. The current evidence action explicitly refuses both full paths without an artifact. The bare p1 addresses the top-level parent and reports no requirement list. |
| N02 | PASS | A direct p1 read on each isolated parent reports 4 mm and Pass or 7 mm and Fail against the same 5 mm limit. The respective local masses are 2.16 g and 10.99 g. Two p1 instances in one parent produce an ambiguity refusal without a file. The left module's root-level steel override is outside the isolated control. |
| N03 | PASS | Actual Studio selects each full path and displays 800 mm³ or 1,400 mm³. A root height edit from 2 to 3 mm retains both nested definitions. Studio saves to a browser project and opens the saved bytes in a fresh context. Both path selections and volumes survive. Fresh MCP refuses the earlier root evidence pin and returns the current failing root measurement. Both nested requests still refuse. |
| N04 | PASS | Fresh native reads pass strict B-rep validation for both leaves. Independent prism arithmetic checks volumes, centroid, bounds, height verdict and local mass to 1e-8 in the respective units. |

## Separate accuracy finding

**FAIL.** The same real `assembly.get` response that lists the leaf paths reports zero bodies and zero volume for both visible nested-only hosts and omits their world bounds. The native and Studio values are 800 mm³ and 1,400 mm³. Source inspection shows the query evaluates `bodyDocOf(inst)` through the part evaluator. The current placed assembly path folds the child features before evaluation. D603 will verify and repair the summary before nested requirement scope expands.

The desktop driver captured five states with no browser or console errors. All 769 source hashes matched through cleanup. Targeted Studio and Model tests passed 24/24 and 13/13. Both TypeScript checks passed on Node 22.19.0. See [commands and hashes](qualification.json).

Positive root-scoped nested requirement evidence, the outer material override's measured result, live AI, mobile and the whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
