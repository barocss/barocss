# D875 — Retain Trim history when Select activates the same outline

P1, rows 09 and 16. SMALL for a reopened sketch with a stored straight main outline. Trim and Select can move the same closed polygon between the active slot and the finished list. The draft history compares the existing Finish order and stable main IDs. It accepts the same exact authored fields and unchanged ordered companion shapes. A closed polygon copy with `pending: false` can represent the same outline. The document, plane, feature index and link still identify the draft.

| Result | Check |
| --- | --- |
| FAIL | At the parent, Studio trimmed the visible construction line from (50, 5) to (60, 5) mm. Select activated the remaining outline. The first Undo restored its width from 44 to 40 mm. The second Undo had no matching Trim state and left the line absent. |
| PASS | On the repair, the second Undo restored that exact 10 mm construction segment while keeping Select and the 40 mm outline active. Switching back to Trim showed both endpoints within 0.02 CSS px. Toolbar Redo removed the line again, and Undo restored it. |
| PASS | Both runs retained the accepted document, selection, History and clean state. Cancel kept the original native source and its 1,600 mm³ Extrude. The D874 same-tool desktop regression passed, including ordered replay and a refused click. |
| PASS | Studio 70/70, both type checks, scoped lint, driver syntax and diff check. Focused cases refuse changed point, constraint, ID or companion ordering, and another drawing tool. The baseline, fixed and regression runs held 360, 360 and 360 inputs through cleanup. |
| NOT_RUN | A changed or curved main outline, no-op Finish after tool repartition, drag Trim, mobile, production build and full suites. |

D876 takes the first drag Trim gesture with straight, separately identifiable intervals and local draft replay. [#2328](https://github.com/barocss/barocss/issues/2328) remains open. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
