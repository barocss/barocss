---
work_id: D594
artifact_type: approved-requirement-version-compare
status: verified
last_updated: 2026-11-11
---

# D594 — Compare saved failures with approved requirement checks

P0 automation, rows 04, 12 and 16. FEATURE qualification of the existing Studio Versions comparison against the working document. The selected first version and the working document must match both SHA-256 revisions in one explicit user acceptance. The proposal record and Design History must agree on the approval. The read uses the same requirement report producer as local MCP.

The original desktop flow showed the edited occurrence and the approval history but had no requirement transition in Versions. The new comparison uses the existing version snapshot and the existing acceptance record. It adds no project files or document fields. It re-evaluates one selected scope at a time. The before and after results must be current and successful. Both must name the same requirement and scope. A changed criterion is reported separately. A recycled occurrence ID cannot establish continuity after a membership-changing proposal.

| Group | Result | Evidence |
| --- | --- | --- |
| C01 Candidate isolation | PASS | Actual Studio opens and saves the original failure. The passing preview leaves the approved-check area absent and retains the working document. |
| C02 Exact acceptance | PASS | Actual Studio accepts P1. Compare shows p1 height 11 to 10 mm and volume 2,200 to 2,000 mm³ as Fail → Pass. The D592 evidence pins match and four retained MCP artifacts remain byte-identical. |
| C03 Negative controls | PASS | The p2 control has no verified recovery. Controlled tests cover a relaxed requirement, a replacement with the same ID, ambiguous or inconsistent history, an agent decision and changed evidence inputs. Hiding the comparison retires a held read. |
| C04 Persistence and read-only review | PASS | Reload and project Open recover both named versions. The comparison stays selected across panel close and reopen. The native file, version log and both saved snapshots keep their exact hashes. |

- **PASS** — Five desktop states, 77 focused Studio checks, 30 Model checks, types, lint, production build and four retained artifact reads.
- **FAIL** — The baseline actual Studio comparison could not display a matching approved requirement check. The final desktop run passes. Independent source review also found panel ownership loss on unmount and recycled occurrence IDs. The final controls cover both.
- **NOT_RUN** — Historical comparison after a later working edit, nested occurrence matching, assembly membership changes through scripts or patterns, whole browser and kernel suites, live providers, mobile and release.

Version snapshots and the approved history persist in the existing project store. Computed comparison rows are transient. The result is a bounded evidence link for the saved version and an exact approved working revision. [Issue #2279](https://github.com/barocss/barocss/issues/2279) stays open. B09 v1 remains 9/9. Four of ten initial product scenarios have accepted v1 evidence. Whole CAD readiness remains NOT_MEASURED.

[Commands and evidence custody](qualification.json).
