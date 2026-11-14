# D1208 — Keep Linked Inset review focus visible in the Dock

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The focused Cancel button can scroll into view when the review opens. On manual cancel, focus can also scroll the opener back into view. The document and geometry paths are unchanged.

| Result | Check |
| --- | --- |
| FAIL | At 1024 × 800 with Chat and the Dock sheet open, the opener was visible with scrollTop 493. Enter focused Cancel at Y −262 to −244 px, outside the Dock's Y 36–800 px. The first test attempt waited for the editor before opening the dock, and the sequence was corrected. |
| PASS | From the same scrolled Dock, Enter focused Cancel at Y 377–395 px. Escape returned focus to the visible opener at Y 461–489 px and kept the document. Both centres passed hit-testing. The first-focus screenshot was visually checked. |
| PASS | The wider 1440 × 1000 desktop passed Enter and Escape, Apply focus, source replacement, Undo and Redo. |
| PASS | Studio type check, scoped review lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Automatic-rejection focus and guidance, collapsed History, full suites, CI and mobile. |

Keep #2481 open. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
