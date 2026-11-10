---
work_id: D600
artifact_type: bounded-product-qualification
status: controlled-pass
last_updated: 2026-11-11
---

# D600 — Verify worker checkpoint evidence in Studio Versions

P0 automation, B09 follow-up, rows 04, 12 and 16. Re-run the D586 local two-worker profile on the current source. Join the final lid decision to the original and accepted native files, requirement reports and existing Studio Versions. This qualification extends the browser driver and uses the existing product paths.

| Group | Result | Evidence |
| --- | --- | --- |
| V01 | PASS | Two Node workers overlap in native evaluation for 47.13 ms. The recovered record links both committed files and the lid candidate digest. Its accepted byte SHA-256 and full-model digest match the native file. The read-only MCP report on the pre-approval p2 measures 3 mm and fails the 4 ± 0.001 mm check. The accepted p2 measures 4 mm and passes. The accepted p1 remains at its required 6 mm. The two p2 report revisions match the worker-approved proposal's native history. |
| V02 | PASS | Studio saves the pre-approval and approved native bytes as versions. Versions shows p2 height changing from 3 mm and Fail to 4 mm and Pass. The independent rectangular dimensions give 1,200 mm³ for p1 and 288 then 384 mm³ for p2. The controlled delivery copies the host's exact native file into the closed browser project before Studio opens it through the project. |
| V03 | PASS | In-place Studio edit changes p2 to 5 mm and 480 mm³. The unchanged height requirement fails in Studio and in a fresh MCP session on the saved bytes. The old evidence pin returns `OUTPUT_STALE` without an artifact. The p1 definition revision and passing check remain the same. |
| V04 | PASS | Project reload preserves the historical p2 approval while the 5 mm working assembly remains open. Comparing the original to the later edit shows no approval. A fresh desktop context also opens the exact edited bytes. The host record and both source native files remain byte-identical. |

The initial driver compared an in-memory optional property with an omitted JSON field. The second driver used standalone Open for a project file with an existing name. Studio refused the duplicate save. The final driver reopens the file through the project. Both earlier receipts are retained.

The final desktop run captured eight states with no page or console errors. The original D586 browser scenario passed again. Targeted Studio checks passed 62/62, targeted Model checks passed 13/13 and the Studio TypeScript check passed on Node 22.19.0. See [commands and hashes](qualification.json).

Automatic delivery of a host checkpoint to a browser project, live providers, in-Studio worker approval, a durable defect ledger, whole-browser and whole-kernel suites, and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
