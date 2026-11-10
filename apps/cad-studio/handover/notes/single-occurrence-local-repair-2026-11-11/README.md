---
work_id: D627
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D627 — Repair one occurrence and protect its siblings

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Studio chat and the CLI can plan one selected occurrence. A single repair uses one worker and a four-unit run budget. Its plan names the other occurrences that have hard requirements as protected inputs. The planner accepts these inputs when their independent authored local dimension checks pass. The native checker must also pass them during candidate creation, decision replay, Studio review and checkpoint Open. The candidate and checkpoint remain bound to the exact one-feature change.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Studio Save, chat and CLI yield the same one-task repair for p3. Selecting p1 would leave p3 failing, so no run offer appears. Studio refuses the original plan after a working edit before making any Start request. |
| K02 | PASS | Desktop Studio previews and opens one terminal-approved edit. Placed heights change from 6, 4 and 7 mm to 6, 4 and 5 mm. The working recheck reports 5 mm and Pass. |
| K03 | PASS | The independent file reader verifies the exact original bytes and both protected occurrences, including placement. Only p3/n1 height and the approval history change. A forced failing native sibling measurement is rejected during candidate creation and decision replay. |
| K04 | PASS | Both CLI start modes hold the same single candidate. The desktop two- and three-task flows and the earlier height-only checkpoint pass. |
| K05 | PASS | Focused Model and Studio tests, type checks, lint and the Studio build pass. |

The first CLI and desktop attempt hit the existing uncovered-hard-requirement guard. The repair plan now records and verifies the protected siblings. [Commands and hashes](qualification.json).

The protected profile covers independent top-level prism dimensions. Whole suites, mobile, live providers and assembly-wide or nested protected checks are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
