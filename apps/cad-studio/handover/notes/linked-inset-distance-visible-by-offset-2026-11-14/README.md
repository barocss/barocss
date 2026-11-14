# D1221 — Show the linked distance beside ordinary Offset

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Sketch places the current linked distance, the existing History edit path and the detachment note in the Offset section. Each appears once.

| Result | Check |
| --- | --- |
| FAIL | The first Chrome context stalled before Studio opened. Only that run's owned Chrome was stopped. The retry reproduced the parent problem at 1024 × 800 with Chat and the Dock sheet open. Linked distance was at Y −51 to −36 px and the History path at Y −24 to 6 px. |
| PASS | At the same size and input position, linked distance moved to Y 688–703 px and the History path to Y 715–745 px within the Y 36–800 px Dock. The ordinary Offset input starts at Y784 and its last 2 px are clipped at this scroll position. The input accepts keyboard entry. |
| PASS | Ordinary Offset 3 mm and Enter preserved the live 2 mm association and left Sketch open. Finish saved 2 mm and a 4 mm extrusion measured 416 mm³ within 1e-7 mm³. The linked-plane draft, detachment and regeneration regression passed in a separate Studio run. |
| PASS | Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | IME, assistive technology, other Dock dimensions, full suites, CI and mobile. |

Keep #2481 open. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
