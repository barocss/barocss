---
work_id: D614
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D614 — Bind a terminal decision to the exact Studio candidate

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

From `apps/cad-studio`, export one candidate, inspect it in Studio against its accepted native baseline and decide from a terminal.

```sh
node scripts/cad-cli.mjs task-run review <run-directory> <task> <candidate>.bcad-candidate
node scripts/cad-cli.mjs task-run decide <run-directory> <operation> <task> approve --review <candidate>.bcad-candidate
```

Use `reject` instead of `approve` to decline a current candidate. The terminal prints the exact receipt and asks for the decision and the displayed short digest. Studio shows the attempt ID next to the digest. The command reads the receipt once. It checks the run, attempt, accepted file and model digests, specification, input, scope and candidate digest. It allows an older observation revision when the complete binding still matches. The terminal approval uses the existing operator token and native decision path. The earlier decision syntax remains available.

The run validates the candidate and control revision again after confirmation and before creating a writer record. It claims the next epoch with an atomic link. A concurrent writer that wins after the check occupies that same epoch. A matching receipt proves candidate identity. Studio interaction is separate evidence.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Actual desktop Studio opens the original review and shows the scoped 5 → 6 mm proposal. The independent 20 × 10 mm prism check gives 1,000 → 1,200 mm³. The sibling stays at 3 mm. |
| K02 | PASS | An actual terminal prompt waits while the run expires and refreshes the candidate. The new attempt has the same specification and candidate digest. The old receipt is refused after the exact response. Record bytes and writer entries are unchanged by the refusal. |
| K03 | PASS | Studio opens the fresh review and clears the previous candidate-open failure notice. The exact terminal response publishes one commit. Studio opens its checkpoint, shows Fail · 5 mm and Pass · 6 mm, and saves the exact accepted native bytes. The original browser project file and version log retain their bytes. |
| K04 | PASS | Focused tests cover mismatched binding fields, a bounded input read, terminal consent, invalid and reused operation IDs, legacy approval, current reviewed rejection and old-receipt replay. A deterministic store test lets a competing writer win after the guard and checks that its record and directory entries remain intact. |
| K05 | PASS | Independent source reviews found the initial claim-before-check race. The final guard runs before the claim. Isolated negative controls detect a missing attempt match, missing control check and a guard placed after the claim. |

The first Studio suite compared a deserialized record with an in-memory snapshot that contained an omitted optional field. The final test uses the durable record on both sides. The first desktop screenshot also showed a stale candidate-open error next to a successful review. The final run verified its removal. See [commands and hashes](qualification.json).

In-Studio approval, live providers, other worker task types, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
