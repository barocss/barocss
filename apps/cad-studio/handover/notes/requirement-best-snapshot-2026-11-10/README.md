---
work_id: D579
artifact_type: requirement-best-snapshot-qualification
status: fixed-and-qualified-for-one-controlled-recovery-suite
last_updated: 2026-11-10
---

# D579 — Rank hard-fulfilled snapshots first

P0, B09, rows 04 and 16. Bounded FULL qualification for the additive policy result and the existing grouped recovery path. [#2414](https://github.com/barocss/barocss/issues/2414).

A snapshot qualifies as hard-fulfilled when every hard outcome is a pass and requirement IDs are unique. A qualified snapshot outranks an exploratory snapshot. Within either class, keep the original order of more total passes, smaller normalized misses, then the first snapshot on a tie. The nested `policy.best.hard_fulfilled` flag, restart hint and restore summary disclose the class.

Ranking compares the same authored requirement records. Reordering rows preserves ranking and the current order on restore. A changed requirement suite starts a fresh rank and blocks restore until rechecked. A change to an evaluation input such as the brief's material can change the candidate while the public model hash stays the same. Recovery compares the canonical revision inputs in that case. Restore still uses the existing evaluation, passed-hard, approval and autonomy guards.

The original grouped native run selected the 20 × 20 × 5 mm box in both orders. Its 2,000 mm³ volume fails the 600 mm³ hard cap, while its two soft width checks pass. The 10 × 10 × 5 mm box is 500 mm³ and passes the hard cap with two soft misses. One original order also recommended a restore that the existing hard guard refused. Both orders now select the 500 mm³ box.

Root ran actual desktop Studio with the existing scripted CLI, real Chat server and real MCP tools. The original tool turn restored 2,000 mm³. The final turn reads both bounding boxes, obtains a restart hint after two rounds without progress, restores 500 mm³, shows the current requirement verdicts and records one prompt history entry with the restored model identity. An independent box oracle checks worker volume and centroid at 1e-9. First Undo returns to the exact 30 mm driving dimension and first Redo restores 10 mm. Public Save writes the accepted native document to the browser project. A fresh browser context opens the exact bytes, observes the absence of a checked recovery snapshot, and edits the driving dimension to 9 mm.

- **PASS** — final grouped ranking and restore, hard-unknown treatment, soft and no-hard cases, existing ties and scores, same-suite ordering, changed-suite refusal, same-hash material context, duplicate-ID guard, evaluator retry, actual Studio lifecycle, focused Model and MCP tests, types, affected lint and Studio build.
- **FAIL** — original native ranking and desktop recovery. One initial driver read misdecoded non-ASCII text in the captured response while the App document was correct. One intermediate Model fixture and one test type annotation failed before correction.
- **NOT_RUN** — live model, broader B09 product acceptance, mobile, whole Model/kernel suites and persistent recovery across turns.

[Commands and receipts](qualification.json). Whole CAD remains NOT_MEASURED. Next is D580, P0 B09, rows 04 and 16, to verify unresolved explicit material IDs in mass checks. [#2416](https://github.com/barocss/barocss/issues/2416).
