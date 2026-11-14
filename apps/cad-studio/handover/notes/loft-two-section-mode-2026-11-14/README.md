# D1170 — Show the effective Loft mode for two sections

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2463](https://github.com/barocss/barocss/issues/2463)

An unguided two-section Loft uses Ruled in creation and History. Show the resolved section order in creation. Smooth remains available for three or more unguided sections. The effective mode of a legacy two-section Smooth flag is Ruled.

| Result | Check |
| --- | --- |
| FAIL | The parent offered Smooth for two sections, omitted it from the saved recipe, and produced a Ruled result. One intermediate driver run retained a locator from its closed browser page. |
| PASS | In desktop Studio, selecting the upper circle first still showed height order Sketch 1 then Sketch 2. Creation and History agreed on Ruled, including a two-section file carrying an older Smooth flag. Open did not rewrite that flag. Undo, Redo and fresh Open replayed the expected body. |
| PASS | Coaxial radii 3 and 6 mm at Z0 and Z20 produced one valid native solid at 1319.468914508 mm³. The conical frustum formula gives 420π mm³ and the difference was within 1e−6 mm³. The three-section Studio control retained the Smooth selection and saved height order [0,2,1]. |
| PASS | D1169 desktop regression, 74 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | History replacement of a Loft guide or section, guided error recovery, a three-section smooth numerical oracle, full suites and mobile. |

Keep #2463 open. D1171 checks replacing a copied Loft guide through History while retaining its section controls and order. Desktop QA is **28/54 (52%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
