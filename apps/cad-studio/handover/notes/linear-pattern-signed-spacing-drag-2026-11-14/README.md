# D1193 — Keep the sign of a Linear Pattern spacing drag

2026-11-14 · FEATURE · P0 desktop QA, rows 09, 20 and 21 · [#2468](https://github.com/barocss/barocss/issues/2468)

The Separate bodies spacing arrow uses the same signed spacing as the number field. The existing nonzero rule refuses the zero point while the pointer is held. The same drag can continue in either direction. The numeric minimum for One body continues to apply to that mode's arrow.

| Result | Check |
| --- | --- |
| FAIL | Early driver runs used the wrong command capitalization and had an offscreen arrow. With corrected framing, the parent changed a left drag from −16 mm to +1 mm rather than −24 mm. |
| PASS | Current desktop Studio dragged −16 → −24 → 0 → +8 → −20 mm without releasing. The zero state disabled Apply and kept the accepted document. Both valid signs recovered the preview. Root inspected the zero state screenshot. |
| PASS | Apply committed the final −20 mm. Independent box and translation geometry yielded strict-valid solid centres at X12, X32 and X52 mm, Y13 and Z4 mm. Each volume was 192 mm³. Undo restored the original and Redo restored the accepted copies. |
| PASS | Model handles 13/13, Studio drag wall 24/24, both type checks, scoped lint, syntax, frozen-source verification, diff and production build. |
| NOT_RUN | Signed Count handle direction and length per increment, Y/Z actual runs, reopened product file, full suites, CI and mobile. |

Keep #2468 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
