---
work_id: D629
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D629 — Reopen a local run from its task handoff

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Studio Open accepts a local task handoff file. The local service verifies the source bytes, rederives the run key, and checks the original model, task scopes and stored run identity. It reads the existing run without acquiring the writer or starting workers. Studio displays the run card and leaves the working model open. The existing review and approved-checkpoint controls retain their separate checks.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Studio refuses a missing run and a damaged handoff. The failed lookups leave the working document intact and create no run directory. The focused test also refuses a stored run with a mismatched feature scope. |
| K02 | PASS | The first fresh desktop session reopens the exact run ID and pending attempt. The current parameter edit and its Undo/Redo survive lookup. After Undo restores the matching source, candidate review displays 5 → 6 mm. |
| K03 | PASS | The second fresh session reopens the same run after terminal approval. The unrelated 8 mm working model stays open until the user selects Open approved checkpoint. Studio then shows the approved 6 mm and retained 3 mm. |
| K04 | PASS | Both fresh sessions send zero Start requests. Run record bytes, writer entries and native object names stay unchanged during lookup and read actions. An independent reader verifies the original native source and the published checkpoint. |
| K05 | PASS | The prepare-repair and earlier two-task desktop paths, focused tests, type checks, lint and build pass. |

[Commands and hashes](qualification.json). Whole suites, mobile, live providers and portable run transfer between machines are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
