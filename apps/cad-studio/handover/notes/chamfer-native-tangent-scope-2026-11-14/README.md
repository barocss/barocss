# D1230 — Show the picked and tangent Chamfer edges

2026-11-14 · FULL · P0 desktop QA, rows 07 and 21 · [#2520](https://github.com/barocss/barocss/issues/2520)

The successful Chamfer preview reports exact native target names from the finishing path that built it. A straight wedge reports the selected edge; its end transitions can add finish faces. An arc on the rounded inset can report the whole tangent rim. When a general finish follows a topology-changing pass and exact original scope is not available, the preview omits the extra scope report. The feature stores the picked edges.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio displayed one selected edge for both 0.1 mm previews. The straight wedge and the whole arc rim produced different geometry. |
| PASS | Chrome WebGPU at 1024 × 800 used real edge picks on the detached rounded inset. The straight path showed one pick and zero tangent additions. The arc showed one pick and seven exact tangent additions. Both previews and active inputs were inspected. |
| PASS | Apply stored only the one selected edge. Strict B-rep, Undo, Redo, Studio Save to the browser project and fresh Open passed. The straight path produced three finish faces and 534.1667457223912 mm³. The arc produced eight finish faces and 533.9953164836115 mm³. Both agreed with independent volumes within 1e-7 mm³. |
| PASS | The mutation replaced one added native name without changing the count. The exact-name assertion failed as intended. The separate Fillet control kept one pick and seven tangent additions. |
| FAIL | First focused Studio run had a missing transform-pick callback in its Fillet viewport fixture. Supplying the callback restored that check. |
| PASS | Sol High native/API review, Kernel 17/17, Model 17/17, Studio 20/20, three type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Imported bodies, History edge replacement, other mixed shapes, assistive technology, full suites and CI. |

The removal volumes are independent. For the straight pick, integrate the triangular wedge along the 16 mm straight span and across its two short curved ends. With distance `d` this gives `16d²/2 + ((1+d)²+1)d − d³/3 − (1+d)(d√(1−d²)+asin(d))`. For the full inner rim, integrate the change in area with height to get `(44+2π)d²/2 + πd³/3`.

The stated acceptance for #2520 is met. Keep #2466 and #2481 open for their remaining cases. Desktop QA is **30/82 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
