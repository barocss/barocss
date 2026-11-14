# D1209 — Return focus after Linked Inset replacement refusal

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

An active review restores keyboard focus through the same owner guard when its worker refuses the candidate. A field-specific offset refusal tells the user to pick a wider planar face. The toast keeps the native reason in Details. Existing document and active-focus guards prevent an obsolete response from taking focus from another control.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio lost keyboard focus to BODY on automatic refusal of a 2 mm inset on a 60 × 3 mm candidate. Its only visible message was the native error. |
| PASS | In the scrolled 1024 × 800 Chat/Dock desktop layout, refusal returned focus to the visible Replace inset source button and showed the narrower-face recovery instruction. The document, History, selected face, original binding and 960 mm³ ring stayed unchanged. Actual screenshot inspected. |
| PASS | A 1440 × 1000 desktop relink passed Cancel, Escape, Apply, Undo, Redo and History display with the accepted 1024 mm³ ring. |
| PASS | 20 focused Model tests, Studio type check, scoped worker, client and hook lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | A delayed worker reply after explicit focus movement, a collapsed History bar, broader refusal categories, full suites, CI and mobile. |

Keep #2481 open for the remaining edit and refusal conditions. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
