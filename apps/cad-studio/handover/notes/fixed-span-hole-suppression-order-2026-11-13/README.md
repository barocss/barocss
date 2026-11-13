# D1022 — name the dependency order for Pattern and Hole suppression

2026-11-13 · FEATURE · P0 rows 05, 08, 15 and 16 · [#2447](https://github.com/barocss/barocss/issues/2447)

- **FAIL, baseline** The existing refusal preserved geometry when suppressing the pattern first. Its primary hint named the failed Hole and gave generic update or suppression advice, without identifying both steps and their order.
- **PASS, fixed** Studio names Hole Ø2 (n3) and Pattern ×3 · span 32 (n2) in both refusal directions. It tells the user to suppress the Hole first and to unsuppress the Pattern first. Each rejected action preserves the document, geometry, selection, dirty state and history controls.
- **PASS** The valid order transitions through a drilled set, three uncut copies, and the single 192 mm³ seed. Restore in reverse order, then Undo and Redo. Strict native checks confirm the named bore, cap loops and volumes within 1e-7 mm³. The prior rolled-back dependent Fillet Studio regression passes.
- **PASS** Visual review, 18 focused Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Fresh Open of suppressed or retargeted states in this run, other dependent feature families, production build, full suites and mobile.

The hints use the actual failed feature from the existing full-history evaluation. The generic dependent refusal stays in place for other families. #2447 remains open until the Fixed span retargeted document passes the remaining desktop preview and fresh Open controls. Desktop QA remains 8/54 and initial scenarios 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
