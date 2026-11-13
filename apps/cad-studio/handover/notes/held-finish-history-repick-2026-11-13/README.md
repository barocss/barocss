# D998 — replace a held finish edge from History

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** The History editor for the held Fillet had no direct edge replacement action.
- **PASS, fixed** Actual desktop WebGPU Studio opened the History editor for a held R1 Fillet and a held 1 mm Chamfer. A click on the sibling solid was refused. A click on the owned stock edge at [60, 0, 5] staged the choice. Cancel kept the original model. Apply retained the feature ID, took its new signature from the picked edge and restored the feature after full evaluation.
- **PASS** Undo returned the original held model and choices. Redo restored the repaired document. In a two-held fixture, repairing the Chamfer left the other Fillet and its choice unchanged. Ordinary numeric and Delete controls stayed disabled during the edge draft.
- **PASS** Visual review, 27 focused Studio tests, type-check, driver syntax and diff check. Source review identified candidate-map ownership, ordinary editor input and renderer mesh handoff. The final path uses the exact accepted document and actual renderer mesh.
- **FAIL, earlier harness** The initial two-held fixtures did not reach a viable Open repair. The final fixture starts with one already-held step and obtains both choices from actual Open. A subsequent fixture assertion was corrected to include its original reference name in the stored hold reason.
- **NOT_RUN** Save after direct repick, nonterminal and multi-edge finishes, varying radius repick, live linked inset edits, Draft/Flange/Hole, delayed renderer handoff reproduction, WebGL2, production build, full suites and mobile.

The qualified action is for terminal held constant-radius Fillet and Chamfer on a current standalone body. Exact volumes matched 9,000 − 10(1 − π/4) and 8,995 mm³ within 1e-7 mm³. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
