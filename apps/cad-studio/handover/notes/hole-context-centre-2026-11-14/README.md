# D1050 — use the right-click point for Hole

2026-11-14 · SMALL · P0 rows 20 and 21 · [#2454](https://github.com/barocss/barocss/issues/2454)

Carry the planar surface point through the viewport context pick and update it with the selected face. An edge or remapped section pick supplies no point. Print maps a point back to model coordinates when its face maps to a native face.

- **FAIL** On D1049, both context-menu Hole starts used the previous left-click centre [9, 7] mm. The right clicks targeted [29, 21] mm on the same face and [77, 12] mm on the other body.
- **PASS** In 1440 × 900 WebGPU Studio, the Hole HUD uses both right-click centres. The keyboard Hole start uses its own left-click centre. Cancel preserves the native document. Apply drills the second body at [77, 12] mm with diameter 8 mm. Its volume is 11,497.345175425638 mm³ and the first body remains 12,000 mm³. Undo and Redo restore the exact expected documents. Visual review confirms the bore in the second body.
- **PASS** Existing desktop context Measure, native pin and section-face replays. Studio type-check, 11 focused checks, driver syntax and diff checks pass.
- **NOT_RUN** Right-click coordinates in Print, curved faces, non-Z Hole starts, WebGL2, full suites, production build and mobile.

D1048–D1050 satisfy the reported #2454 desktop scope. Desktop QA reaches 16/54 on issue closure. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
