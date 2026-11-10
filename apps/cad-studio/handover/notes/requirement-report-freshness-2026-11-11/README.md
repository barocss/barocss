---
work_id: D589
artifact_type: current-requirement-display-repair
status: verified-studio-boundary
last_updated: 2026-11-11
---

# D589 — Show current requirement verdicts

P0, B09, rows 04, 15 and 16. SMALL repair from the read-first review of [#2279](https://github.com/barocss/barocss/issues/2279).

| Existing contract | Authority |
| --- | --- |
| Brief, draft and requirement fields | `basis`, source text and user confirmation describe design intent. A verified quote says the user supplied the words. |
| `runCheck` and `checkSpec` | Native measurements produce pass, fail or unknown. A named outcome can carry measurements and entities. |
| `requirementResults` and the result store | Named part, requirement, run and input fingerprint track freshness. Stale and unresolved evidence cannot satisfy a current check. |
| Task run and candidate approval | A task's spec revision and candidate evidence identify the proposed result. The local host records accepted publication through its separate decision. |
| Studio Requirements panel | An existing transient consumer. It checks the current accepted model after evaluation, and keeps the last report while a new one is pending. |

The last path exposed a display error. The panel labelled the report stale but continued to render two green checks and a count of two passes after Open accepted a newer file. The fix derives the visible report from the existing stale flag. The panel keeps its status text and shows unknown rows while the matching report is pending. Its summary, row styles, filter and reference actions read only the visible current report.

Actual desktop Studio opened a 20 × 10 × 10 mm native plate and showed two passing requirements. It then opened the 11 mm revision with the same feature and check IDs. The driver held one successful native Worker reply. While the accepted document showed 11 mm, the repaired panel showed only `stale` and two unknown rows. When the exact held reply arrived, width passed and the height row reported 11 mm against its 10 mm maximum. The Parameters panel corrected the height to 10 mm. First Undo restored the exact failing document, and Redo restored the exact passing document.

Python checks five settled snapshots against independent rectangular-prism volume and centroid arithmetic at absolute tolerance 1e−8. Expected volumes are 2000 and 2200 mm³. The affected D578 browser flow also passed, including the local project Save and fresh Open, the deferred mass reply, and the failure warning after it settled.

- **PASS** — Three frozen groups, actual desktop reproduction and fix, independent geometry, affected D578 desktop regression, focused checks, lint, syntax and type checks. Root reviewed the pending and failed screens.
- **FAIL** — The original pending report showed `2 ✓ · 0 ✗ · 0 ? · stale` and two green rows. The baseline remains recorded.
- **NOT_RUN** — Durable defect-resolution history, occurrence-scoped or face-reference checks, broad browser and kernel suites, mobile and live providers. The existing issue remains open.

The next B09 action is the direct CLI creation gap from D587. Select a bounded two-length rectangle authoring path and verify its CLI/MCP, native and actual Studio consumers. The #2279 mapping supports a later evidence report without a second diagnostic engine.

[Commands and evidence custody](qualification.json).
