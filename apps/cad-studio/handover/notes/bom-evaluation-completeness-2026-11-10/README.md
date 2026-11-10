---
work_id: D581
artifact_type: bom-evaluation-completeness-qualification
status: fixed-and-qualified-for-ordinary-bom-evaluation
last_updated: 2026-11-10
---

# D581 — Refuse BOM results with missing evaluations

P0, B05, rows 10 and 16. Bounded FULL qualification of the shared Model refusal and its Studio consumers. [#2420](https://github.com/barocss/barocss/issues/2420).

The existing BOM gave a refused or missing root evaluation a successful 0 g line. In a two-part assembly, the Worker refused occurrence `second` at feature `n1` because its extrude height was zero. Studio displayed the first part's 7.8 g as the assembly total and offered the same purchase CSV as the healthy assembly. Independent box volume and material density give 7.85 g for the steel box and 2.7 g for the aluminium box. The healthy total is 10.55 g and Studio displays 10.6 g. The Python oracle reads CSV headers, row names, quantities and the separately displayed mass within 0.050000001 g.

Both Model producers now require a successful evaluation for every contributing original or cut document. `BOM_EVALUATION` identifies the root or full occurrence path, the evaluation stage, and the native feature, code and reason when available. A missing result has an explicit reason. A successful empty evaluation still contributes zero. Model keeps shared-definition reuse, existing suppression and hidden membership, and the linked-housing refusal. Existing output preflight still runs, and a missing production read after preflight yields an error-only response. Team reports failed with no number or value. Sync drawing reads retain the refusal and a settings edit can remove its BOM dependency.

Studio keeps the diagnostic and disables BOM actions when the current evaluation fails. A drawing can show its geometry and the failure reason. SVG and DXF require the current BOM when the active sheet uses it. PDF requires it when any sheet uses it. The legacy continuation sheet uses the whole drawing's assembly scope for PDF, including when only the first sheet carries a BOM table. The user can remove balloons through the existing control or reopen a healthy assembly to restore export availability.

- **PASS** — real desktop BOM refusal, healthy reopen and native Save/fresh Open. The BOM refusal preserves the opened document, history controls and dirty state. The BOM CSV is captured before browser download and parsed independently. Actual desktop Drawing refuses an incomplete balloon sheet and a legacy two-sheet PDF, then verifies recovery. The D575 stale BOM regression passes independently. Focused Model/Studio, the scripted RB9 tests, affected lint, both type checks and Studio build pass at their recorded scopes.
- **FAIL** — original Model and desktop BOM results, the original single-sheet Drawing export gate, and the interim legacy continuation PDF gate. The expanded Model run has one existing `TEXT_OVER_LINES` assertion, reproduced with the parent Model source. Initial driver fixtures and an intermediate test type error are recorded with their corrected runs.
- **NOT_RUN** — actual Drawing PDF/SVG/DXF file bytes and independent readback, whole Model/kernel suites, mobile, live agents and whole B05 acceptance.

[Commands, scope and receipts](qualification.json). Whole CAD remains **NOT_MEASURED**. Next is D582, P0 B09, rows 04 and 16, to reproduce keep-out equality and range verdicts with a chord error interval. [#2422](https://github.com/barocss/barocss/issues/2422).
