# D871 — Inspect local mobility of a straight sketch outline

P1, rows 09 and 16. FULL for the opt-in CAD diagnostic. The Studio sketch panel lists locally movable points and edges in the active settled closed straight outline, up to 16 authored points. Hover or keyboard focus highlights one entity through the existing inspection overlay. An edge qualifies when either endpoint can move. The selection remains available during inspection.

The diagnostic reads the supplied coefficients, checks the existing residual tolerances and uses the same undamped Jacobian and numerical rank threshold as the solver. It checks an orthonormal nullspace against the original Jacobian. It maps dependent coordinates to point IDs and excludes solver helper points from the outline list. Unsettled, unsupported or numerically uncertain outlines show an unavailable status. This is first-order numerical mobility. Finite motion requires separate analysis.

| Result | Check |
| --- | --- |
| PASS | Analytic 40 × 20 mm anchored H/V rectangle: rank 6 lists points 2, 3, 4 and all four edges. Width lock gives rank 7 with points 3, 4 and edges 2, 3, 4. Edge 3 can translate while its length stays fixed. Height lock gives rank 8 and an empty list. |
| PASS | The native tests compare two independent analytic tangent directions to the computed nullspace and check the original Jacobian within 1e−12. Point/constraint order permutations retain the same identity set. A raw free column fails the Jacobian check. Near-rank, weak ambiguous participation, unresolved inputs and malformed H/V references are refused. |
| PASS | Actual desktop Studio tested keyboard focus, pointer hover, Escape, a no-op sketch Undo, and a change of inspection owner with a live inline dimension. Inspection added no worker requests, file writes, document changes or history entries. A contradictory perpendicular edit retained the current mobility. |
| PASS | Studio added and removed driving dimensions, edited the width to 42 mm, and used sketch Undo/Redo. A same-ID translated outline cleared the old highlight and resolved a fresh mark at (100, 35) mm. A circle then showed unavailable. Existing constraint row and comparison desktop regressions passed. |
| PASS | Finish and document Undo/Redo retained the authored side IDs and Extrude. Three native reads agreed with the analytic eight corners and 4,000 mm³ within 1e−8. The 1,196-byte Studio project file reopened in a fresh context. Inspection state was absent from its authored data. |
| PASS | Emitted CAD tests 9/9, Model 50/50, Studio 58/58, package emission, types, production build, scoped lint and driver syntax. Two independent source audits reviewed numeric and UI custody. The mutation control passed and six single-source mutants failed their designated checks. |
| FAIL | The first driver had an inspector import typo and stopped before Studio. The first Studio run found that Undo could restore a row under the stationary pointer and revive its highlight. A new pointer movement now starts the hover highlight. The first mutation runner rejected a valid failure because its assertion-name pattern was too narrow. |
| NOT_RUN | Full suites, mobile, cross-browser checks and mobility for curved or compound sketch geometry. |

The declared first scope of [#2330](https://github.com/barocss/barocss/issues/2330) meets its acceptance checks. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
