---
work_id: D633
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D633 — Preserve replacement-run provenance

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

The replacement handoff includes the original stale task selection. Before creating a new run, the local service checks the original accepted native file, run revision, task, attempt and scope. It derives the same replacement plan from that model and the exact saved revision. The new run record retains the original accepted file SHA-256 and task input digest alongside the task selection from its first write. The prior run stays read-only during this workflow. An ordinary handoff keeps its existing format and key.

After starting the replacement, the user can export the handoff while its saved working source is current. Reopening the exact handoff reads the existing replacement and its stored provenance. The Studio card shows the prior run, revision, task, attempt and digests under Replacement provenance.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio starts one replacement and shows the exact prior task and attempt. The new run retains the same fields after terminal approval. |
| K02 | PASS | The local service refuses a handoff with a new valid checksum and the wrong prior attempt. It creates no run directory for the refused request. |
| K03 | PASS | A fresh desktop Studio context reopens the approved replacement from the exact start handoff. The provenance remains visible after status refresh. The working model, original run and replacement run records stay unchanged. |
| K04 | PASS | An independent reader binds the handoff to the new run key, joins its source bytes to the accepted checkpoint and matches the previous attempt to the original run record and native model. |
| K05 | PASS | Desktop baseline and stale rebuild regressions, focused suites, type checks, lint and build pass. A direct CLI start of the replacement refuses before creating a run directory. |

[Commands and hashes](qualification.json). Desktop qualification covers one height replacement and reuses the exact handoff sent by Studio Start. The export-button file write, desktop width replacement, dependent replacement, cross-host transfer, whole suites, mobile and live providers are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 scoped groups. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
