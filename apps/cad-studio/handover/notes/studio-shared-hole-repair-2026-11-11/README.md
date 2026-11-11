---
work_id: D637
artifact_type: bounded-product-qualification
status: verified
last_updated: 2026-11-11
---

# D637 — Repair a shared hole from a native check in Studio

P0 automation, B09 follow-up, rows 04, 10 and 16. FEATURE qualification of the existing workflow.

One Studio chat turn reads the selected H1 finding for p2 and creates an assembly proposal through the existing tool. The proposal edits hole feature n2 from Ø3 to Ø4 mm. The finding belongs to the earlier n1 height attempt. Studio previews the scoped edit, records explicit user acceptance and saves the repaired native model alongside the original project file.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The actual local chat server and stdio MCP read the pinned `HOLE_OFF_PATTERN` result in the same turn that proposes one p2 edit. At L4 the agent cannot approve the assembly proposal. |
| K02 | PASS | Studio shows a placed volume change of −16.49 mm³ during Preview. The working assembly stays unchanged until explicit Accept. Approval history records the user and both evidence revisions. |
| K03 | PASS | Studio saves a separate project document and reopens it after a page reload. The original file and both previous run records and native objects retain their bytes. Both authored height criteria and their failed measurements remain intact. |
| K04 | PASS | The native reader changes from `PATTERN_MISALIGNED` to pass. The independent oracle checks both plates, eight rational trim planes and the original and repaired native volumes, axes and centroids. The Ø4 through-hole spans world Z20–23 mm. |
| K05 | PASS | The exact reopened project bytes start two held height candidates. Both pass lease, validity, contract and assembly gates. The run has zero task publications. |
| K06 | PASS | The desktop selected-evidence regression, focused suites, type checks, driver syntax and Studio build pass. |

[Commands and hashes](qualification.json). Two early desktop checks **FAIL** on driver assumptions about an expanded detail and the L2 refusal message. The final check exercises the assembly approval gate at L4. The independent reader also needed to filter scope rows out of the hard-requirement check. Geometry expectation values come from the independent High review and the analytic oracle. Live model behavior, publishing the two new height candidates, whole suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
