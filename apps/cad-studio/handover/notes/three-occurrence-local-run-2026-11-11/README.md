---
work_id: D624
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D624 — Run three independent local CAD tasks

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Studio chat and the CLI accept two or three distinct placed occurrences with supported stated dimension targets. The host admits only independent tasks for this local profile. One host owns the durable record. It starts up to two dispatches and starts the third when either dispatch, including native validation, releases its slot. The planned budget is 8 units for two tasks and 12 for three.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The same saved source yields the ordered mixed-width and height plan in Studio chat and the CLI. Studio start, CLI start from the saved plan, and CLI start from the exported handoff each hold three candidates. Duplicate and oversized selections are refused. |
| K02 | PASS | The real host test holds the first worker, releases the second, and observes the third start while the first still runs. The unbounded-dispatch overlay fails the assertion. Desktop Studio uses the real local worker threads. |
| K03 | PASS | The third candidate previews 3 → 5 mm and +192 mm³ while the accepted source stays unchanged. The first terminal approval invalidates both older sibling pins. The second invalidates the rebuilt third pin. All three retired reads return 409. |
| K04 | PASS | Studio opens each terminal-approved checkpoint directly. The final placed dimensions are 24 × 10 × 5, 12 × 8 × 4 and 12 × 8 × 5 mm. The independent reader verifies exact scoped edits, the byte chain, three human approval records and the final prism volumes of 1,200, 384 and 480 mm³. |
| K05 | PASS | The existing two-task width/height flow and historical height-only checkpoint open in Studio. Focused model and Studio tests, type checks, lint and the Studio build pass. |

The fixture has one plain rectangular width target and two extrusion-height targets. Review and approval remain explicit. The final run used 3 of 12 budget units. The browser project retains its original saved bytes. [Commands and hashes](qualification.json).

Whole suites, live providers, mobile and dependent tasks are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
