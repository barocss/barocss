# D1140 — Refuse invalid 3D Sketch constraint values

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2461](https://github.com/barocss/barocss/issues/2461)

The 3D Sketch editor keeps the unaccepted value in its field. A blank value, a non-positive length or distance, or an angle outside 0° < angle < 180° blocks Apply and the window Enter shortcut. Length and distance fields show mm. Angle fields show degrees. Creation and history re-edit share the editor.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio accepted Apply at Length 0, closed the editor and retained 30 mm. |
| PASS | Desktop history retains 0 and a blank as distinct inputs. Apply and Enter leave the saved sketch and document history intact. Angle 180° blocks Apply while a valid Length 40 mm is pending. Restoring 90° allows Apply, Undo, Redo and history re-edit. The saved segment measures 39.99999999999999 mm. |
| PASS | Desktop Studio created a new 30 mm line and added Length. It refused 0 and accepted 20 mm. The saved segment measures 20.000000000046263 mm. Both length controls meet the 1e-8 mm test limit. |
| PASS | Seven focused Studio tests, Studio type check, scoped lint, driver syntax and diff check. |
| NOT_RUN | Circular Pattern creation/history range parity, full suites and mobile. |

Two qualification attempts had incorrect test control activation and one retained a locator from a closed context. The final run uses the current desktop context and the command palette. The baseline and final runs are recorded in [commands and hashes](qualification.json).

#2461 remains open. Desktop QA is **23/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**.
