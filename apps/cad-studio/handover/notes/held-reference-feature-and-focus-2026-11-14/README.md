# D1247 — identify held references and move focus to the next decision

2026-11-14 · SMALL · P0 rows 15, 16 and 21 · [#2539](https://github.com/barocss/barocss/issues/2539)

- **FAIL, baseline** Desktop Chrome WebGPU at 1440 × 900 and 1024 × 800 showed two generic feature rows, zero affected dimensions and two model-preview controls per candidate. Enter on the first candidate moved focus to the page body.
- **PASS** The rows identify Chamfer 1 (n3) and Fillet R1 (n4). Confirm buttons carry the respective feature name in their accessible labels. Zero counts are omitted and Technical details retain the reference names. Each feature candidate has one model preview. The previews select distinct edges and preserve the document and both 9,000 mm³ bodies.
- **PASS** Keyboard Enter confirms only the Chamfer and focuses the Fillet candidate preview at both desktop sizes. Chamfer is 8,995 mm³; Fillet remains held on 9,000 mm³. Undo and Redo recover the exact documents. Native Save and fresh File Open retain the confirmed Chamfer and the still-held Fillet.
- **PASS** A drawing dimension case retains both previews. Chrome compared the two actual highlighted drawing edges within 0.01 client px, opened the same candidate in Model, and confirmed it explicitly. Undo and project Save/fresh Open passed. Visual review, 48 focused Model tests, Studio type-check, panel lint, production build, four driver syntax checks and diff checks passed.
- **NOT_RUN** Screen reader, strict native B-rep for this UI-only change, full suites and mobile. Desktop QA was 41/106 (39%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
