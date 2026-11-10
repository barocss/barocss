---
work_id: D601
artifact_type: bounded-product-qualification
status: repaired-and-verified
last_updated: 2026-11-11
---

# D601 — Keep saved failures when an approved requirement changes

P0 automation, B09 follow-up, rows 04, 12 and 16. SMALL correction to the existing read-only Versions comparison. It uses the exact user-approved revision pair and the existing requirement evidence producer. The native document, approval policy and numerical checker keep their existing formats and behavior.

| Group | Original | Fixed |
| --- | --- | --- |
| R01 | FAIL | PASS. An 11 mm plate fails 10 ± 0.1 mm. The pending proposal leaves the accepted evidence identical. Actual Studio approval widens the criterion to 10 ± 1.1 mm. The unchanged 2,200 mm³ solid passes that new criterion. Versions shows both the saved failure and the new criterion. It records no failure-to-pass geometry result for the changed criterion. |
| R02 | FAIL | PASS. After approval withdraws the only criterion for occurrence p1, it remains selectable. Versions shows the withdrawal and the saved 11 mm failure. The duplicate geometry and verified requirement on p2 survive. The real MCP refuses an attempt to remove that protected requirement. |
| R03 | PASS | PASS. Studio reload keeps both original snapshots and the current project bytes. MCP refuses the earlier revision pin without an artifact, reads the widened criterion as passing, and reports no current list for the withdrawn scope. The p2 check still fails at its original tolerance. |
| R04 | NOT_RUN | PASS. The existing D595 flow still reports a physical 11→10 mm recovery for an unchanged requirement. The historical view preserves a later failing working revision. |

The original Studio run labeled the tolerance edit but omitted its saved measured failure. When p1's last criterion was withdrawn, the scope selector showed p2 alone. The fixed comparison retains scopes with an earlier check and distinguishes changed criteria from withdrawals. It shows the earlier result only when the old snapshot reports a current failure. It checks the after revision even when no requirements remain.

The fixed criteria flow captured two desktop states. The D595 regression captured ten. Both preserved 303 source hashes through cleanup. Targeted Studio and Model checks passed 39/39 and 19/19. See [commands and hashes](qualification.json).

The view recomputes saved checks from immutable versions. It carries no independent defect ledger. Nested occurrence matching, live AI, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
