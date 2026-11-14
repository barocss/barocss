# D1158 — Preserve positive drafted Cut depth in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

An attached, sketch-anchored Cut uses positive Distance in creation, History and edit handles. Keep the existing signed native representation for drafted cuts and the existing positive-height, negative-start representation at zero Draft. Apply height, start and Draft together when switching representation. Explicitly offset and standalone extrusions retain their existing signed editing.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio displayed Distance −2 for a Cut created at 2 mm. Applying +4 pointed the cutter outward and restored the full 12000 mm³ stock. A previous baseline driver stopped at the free-sketch History locator. The corrected driver reproduced the product failure. |
| PASS | Desktop creation and History refuse a negative Distance. An excessive positive Draft reports wall closure, and Enter leaves the accepted stock unchanged. Supported +10° Draft preserves a 12 × 8 mm opening. Depth 2 produced Z8, an 11.294692 × 7.294692 mm floor and 11821.774518946 mm³ remaining. Editing to 4 produced Z6, a 10.589384 × 6.589384 mm floor and 11669.771517741 mm³ remaining. A frustum integral and native vertex measurements agreed within 1e−7. |
| PASS | Undo and Redo restored exact documents. Draft 10° → 0° → 10° kept the same opening and depth; the straight result was 11616 mm³. Save and fresh Open retained the result and History inputs. Visual review and the zero-draft Cut and ordinary signed Extrude regressions passed. |
| PASS | Sol High review, 27 Model and 3 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. The direct edit command test verifies positive handle direction, scale and preserved Start Z defaults. |
| NOT_RUN | Another working plane, arbitrary/non-planar Draft cuts, actual viewport drag on a drafted Cut, full suites and mobile. |

Keep #2464 open. D1159 verifies ordinary Cut on additional work planes. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
