---
work_id: D632
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D632 — Replan a stale task from revised saved requirements

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Studio prepares a new local plan for one stale occurrence after the user saves a revised stated dimension. It checks the original run revision and stale attempt, reads the verified native baseline, and requires the saved model to retain the accepted geometry, sibling requirements and existing history. The selected occurrence and field come from the stored task. Preparation leaves both runs untouched. A separate Studio action starts the replacement from the exact saved bytes. Terminal approval remains required.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Terminal approval of p1 retires the original p2 candidate. Its old review receipt cannot publish. |
| K02 | PASS | Studio refuses an unsaved requirement change and a saved model that changes the accepted sibling. Preparation creates zero replacement runs. |
| K03 | PASS | Studio prepares the revised p2 target at 5 mm. The explicit Start creates one new run with p1 protected. Studio previews 3 → 5 mm and leaves the working model at 3 mm until the user opens the terminal-approved checkpoint. |
| K04 | PASS | The desktop workflow and independent native reader confirm final heights of 6 and 5 mm, exact replacement baseline bytes, and one publication in each run. The original run record and native object list stay unchanged throughout the replacement. |
| K05 | PASS | Desktop rebuild and repair regressions, focused suites, type checks, lint and build pass. |

[Commands and hashes](qualification.json). This path covers an independent top-level task on retained accepted geometry. Desktop qualification exercises the height change. A width replacement, geometry changes between runs, dependent replacements, whole suites, mobile and live providers are **NOT_RUN**. The replacement link lives in the prepared Studio action. D633 covers durable, verified linkage. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
