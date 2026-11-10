---
work_id: D580
artifact_type: unresolved-body-material-qualification
status: fixed-and-qualified-for-ordinary-body-mass
last_updated: 2026-11-10
---

# D580 — Preserve unresolved body material provenance

P0, B09, rows 04 and 16. Bounded FULL qualification for the material evidence in analysis and grouped tool responses. [#2416](https://github.com/barocss/barocss/issues/2416).

For a native 10 × 10 × 10 mm box, the independent volume is 1,000 mm³. Catalogue Al6061 gives 2.7 g and mild steel gives 7.85 g. The original reader preserved the requested unresolved ID, but the Model and desktop Studio treated 2.7 g as confirmed and passed a 3 g cap. The fixed report marks that estimate assumed and carries the exact unresolved ID. The mass check returns unknown for the affected scope. Known-only mass and volume remain independently measurable.

Schema 3 preserves arbitrary nonempty strings, including whitespace and case variants, in base, nested and pending body definitions. A valid schema 4 bundle keeps the same body material policy. An exact empty string inherits a stated catalogue brief like an unset value. Explicit unresolved IDs take precedence over that brief until corrected. Nonstring authored values are refused by the native reader. Direct Model reports mark invalid IDs as assumed. The existing occurrence-override validation remains in place. An unresolved material and incomplete bead accounting can both appear in the same mass diagnostic.

Studio shows unknown mass and the literal ID in its existing controls. Selecting a catalogue material on an unresolved body writes the chosen ID even when it equals the Studio default. Material-only changes now refresh requirements from the accepted body looks and brief. Previous results are marked stale until the next report. Native-file MCP checks preserve a literal ID that matches an older tool name. The local numeric estimate remains available with explicit provenance.

Root tested actual desktop WebGPU Studio from a steel control through Open, an unresolved body, explicit Al6061, a malformed-file refusal, first Undo and Redo, and a later steel edit. A malformed Open preserves the active document, history, selection and dirty state. Public Save and fresh Open preserve both the unresolved document and the repaired document. An independent box oracle verifies evaluated volume and centroid at 1e-9. Root reviewed the actual Inspector and requirement panel. [Commands and receipts](qualification.json).

- **PASS** — native and direct Model provenance, grouped MCP text and structured responses, ordinary desktop Inspector and requirements, literal-ID Save and fresh Open, explicit repair and Undo/Redo, focused Model and MCP, affected lint, type checks and Studio build.
- **FAIL** — original Model and desktop false pass. The first repair run also exposed a stale requirement after a material-only edit. The first focused run exposed unsupported test fixture shapes for schema 4 and a BOM test without an assembly. An intermediate Model type check found one missing test annotation. Final receipts cover the corrected paths. The D578 desktop regression also passes with the refreshed requirement inputs.
- **NOT_RUN** — live models, mobile, whole Model/kernel suites, broad B09 acceptance and unresolved mass in team budgets, manufacturing and occurrence-specific UI.

Whole CAD remains NOT_MEASURED. Next is D581, P0 B05, rows 10 and 16, for refused or missing assembly evaluations that can produce misleading BOM mass. [#2420](https://github.com/barocss/barocss/issues/2420).
