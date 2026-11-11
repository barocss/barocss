---
work_id: D634
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D634 — Preserve the approved assembly on a shared hole conflict

P0 automation, B09 follow-up, rows 04, 10 and 16. FULL interface qualification.

The local worker used to turn a completed native gate refusal into a generic worker failure. The host lost the result and charged the unknown reservation. A worker now returns the bound submission and measured usage when its native gate refuses. The host evaluates that submission again. If its own gate refuses, it records that finding. If the host passes a candidate that the worker refused, the run reports an evidence mismatch and offers no candidate. A crash retains the existing worker failure path.

The fixture has two aligned plates with a stated shared H1 hole pattern. H1 has a 4 mm diameter and a world axis through (5, 5) along +Z. The incompatible control has a 3 mm hole in the second plate. It retains the 4 mm shared contract.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Studio starts two compatible scoped candidates. A terminal decision publishes the first height edit. Studio opens the native checkpoint at heights 6 and 3 mm with both original Ø4 holes and the original shared contract. |
| K02 | PASS | Studio refuses a replacement from a saved model with a changed shared contract. The obsolete terminal candidate receipt also refuses. The original run and native objects remain unchanged after both requests. |
| K03 | PASS | Studio shows two native gate refusals for the Ø3 conflict. The run retains the exact incompatible source, exposes no candidates and has zero publications. The worker effort is two known units and zero unknown units. |
| K04 | PASS | Studio opens the original approved checkpoint again with byte-identical content. An independent reader joins both runs and checks authored placement, hole geometry, candidate volumes and centroids against closed-form values. |
| K05 | PASS | The host refuses a stale input digest from an earlier H1 revision and an unconfirmed worker refusal. The current H1 input still approves. The replacement-provenance desktop regression, focused suites, type checks, lint and build pass. |

[Commands and hashes](qualification.json). First desktop attempt **FAIL** on the generic refusal code and unknown effort. The independent geometry review supplied analytical values for the selected plates. Studio currently shows the native gate code. Exact failed check details are the next item. Dependent tasks, collision-driven refusal, whole suites, mobile and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**.
