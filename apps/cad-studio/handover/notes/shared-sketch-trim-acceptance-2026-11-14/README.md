# D1131 — Qualify shared-edge Trim in desktop Studio

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

| Result | Check |
| --- | --- |
| PASS | Actual 1024 × 800 desktop Studio created the two adjacent 10 × 10 mm outlines. Overlaid Lines identified their separate source occurrences and drew the same screen segment in opposite directions. |
| PASS | Trim first previewed (14, 6) → (14, 16) mm, opened the first outline and retained the second. Finish named the open endpoints and preserved the draft. Draft Undo cleared that refusal and restored both outlines. Redo restored the exact first cut. |
| PASS | The next click previewed and removed the reverse occurrence. Finish made one closed outline. A 2 mm Extrude produced a valid native 400 mm³ result. Document Undo and Redo retained the exact states. |
| PASS | The same-head existing D1094 flow chose and dimensioned the first diagnostic occurrence and kept the second outline unchanged. Ten focused Studio tests, driver syntax and diff check passed. |
| NOT_RUN | A direct transfer from the diagnostic occurrence to Trim, individual region Extrude, partial overlap in this run, full suites and mobile. |

#2459 remains open. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
