---
work_id: D604
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D604 — Read requirement evidence for nested occurrences

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. FULL review and mutations for the public `requirement-evidence` output. D602 established that Studio selects a nested leaf by its complete path. At that revision, the MCP output explicitly refused all nested paths.

The read resolves one visible occurrence at each level of the path. It measures the authored leaf in local definition coordinates with inherited shop rows and effective root-to-leaf material overrides. The output carries the full occurrence path, the current root revision and the authored definition revision. Missing, malformed, ambiguous, hidden and reserved paths fail before evaluation. Subassembly containers, assembly cuts and linked bearing housings are outside this scope. A nested physical check with an unavailable closed-body volume fails before publication.

| Group | Result | Evidence |
| --- | --- | --- |
| E01 | PASS | Actual MCP distinguishes `p1/p1` and `p2/p1` although both leaves have ID `p1`. Local heights are 4 mm (pass) and 7 mm (fail). Effective masses are 6.28 g and 10.99 g. Without the outer steel override the left definition reads 2.16 g. An independent Python oracle checks native solid volume, bounds and centroid for both boxes. The volume tolerance is 10⁻⁸ mm³. |
| E02 | PASS | Desktop Studio selects both leaves, edits the root height, saves to the project and opens the saved bytes in a fresh context. The leaves retain their exact paths and measurements. MCP refuses the previous root revision and gives the two current results with the same definition revisions. |
| E03 | PASS | Actual MCP rejects bad paths and ambiguity at the root and local host. The unambiguous sibling remains readable. Focused Model tests cover hidden paths, the reserved base name, nonleaf scopes, assembly cuts, linked bearing housings and unavailable closed-body volume. Existing direct reads keep their behavior. |
| E04 | PASS | Focused Model tests verify nearest inherited shop-row precedence, effective material and full-path freshness. An occurrence color edit preserves physical evidence freshness. A material change makes the affected physical result stale. |

Root reviewed the reopened Studio screenshot. The browser run captured five states, kept 770 source pins identical through cleanup, and produced zero page errors, console errors or downloads. Focused Model and Studio tests passed 89/89 and 52/52. Both TypeScript checks, affected lint, Studio build and five isolated mutations passed. The first Model type check failed because the refusal fixture did not narrow the evaluator's nullable union. An explicit success guard corrected the fixture. The product and browser source capsule was unchanged by that test-only edit. See [commands and hashes](qualification.json).

In-Studio nested requirement verdicts, nested approval history, positioned requirement measurements, live providers, whole browser and kernel suites, and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
