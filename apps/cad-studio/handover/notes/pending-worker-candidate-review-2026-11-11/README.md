---
work_id: D613
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D613 — Review a pending local worker candidate in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification. From `apps/cad-studio`, export the pending task for review.

```sh
node scripts/cad-cli.mjs task-run review <run-directory> <task> <output>.bcad-candidate
```

The CLI reads the existing run record and exports one task that awaits a decision on the accepted baseline. It checks the attempt, operation, lease, specification and accepted reference without taking the writer lease. It writes the review file outside the run store.

Open the accepted native baseline in Studio, then open the candidate file. Studio verifies the file checksum, both baseline digests, the compiled task, its scope and the reconstructed candidate digest. It reuses the worker's native geometry and requirement checks. The review displays the short candidate digest used by the terminal prompt. Preview changes the drawing of one occurrence. The accepted document remains available for Save. Closing the comparison, switching to an incompatible view, editing the document or restarting the Worker hides or retires the preview.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Two local tasks reached awaiting decision through the real CLI. The review command emitted the selected base candidate without changing the run record, run entries or accepted native file. The run retained zero commits. |
| K02 | PASS | Actual Studio displays task `base`, occurrence `p1/n1`, 5 → 6 mm and +200 mm³. Native placed bounds change only the base. Independent arithmetic gives 1,000 → 1,200 mm³ for the 20 × 10 mm profile. The sibling remains 3 mm high. The one candidate requirement passes at 6 ± 0.001 mm. |
| K03 | PASS | The candidate uses a blue tint. Returning to the accepted model, collapsing Versions or isolating the sibling restores 5 mm in the viewport. Saving during preview keeps the accepted file and the existing version log byte-identical. |
| K04 | PASS | A newer native Open retired a delayed candidate read. The delayed result did not start a candidate placement. The candidate was refused against the changed baseline, and Undo did not revive the old review. Focused checks also refuse wrong task, occurrence, specification and candidate digest, unavailable native evaluation, and a retired run candidate. |
| K05 | PASS | CLI tests refuse output and run-directory symlink aliases and a mixed-case alias where the filesystem supports one. Long output filenames still work. Both review lanes cleared the final source. |

The first focused Studio run failed to compile because the test used the same local name for two review values. The final run uses separate names. Source review also found that lexical path comparison could write inside the run through symlinks or case aliases. The final guard compares the actual directory identity and writes to the checked destination with an exclusive temporary file. Earlier desktop receipts remain outside Git.

The receipt is offline and reports that the task awaited a decision at export. It is an integrity-checked review input. It carries no decision authority and has no live run status. The terminal host still approves or rejects through its existing path. The qualified profile is one independent extrusion-height task. See [commands and hashes](qualification.json).

Decision binding from the reviewed file, in-Studio approval, broader worker profiles, whole suites, mobile and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
