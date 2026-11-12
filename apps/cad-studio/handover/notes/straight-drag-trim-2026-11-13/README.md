# D876 — Preview and commit a straight drag Trim stroke

P1, rows 09, 16 and 20. FEATURE. Trim now previews a primary pointer stroke after 5 CSS px of travel and applies the entire result on release. The stroke uses continuous segments between recorded positions. It can remove up to three intervals from separate, identified, two-point open lines in a straight sketch. Each target needs two interior boundaries and cannot carry dimensions or constraints. The planner accepts at most 64 sketch pieces and 256 pointer samples. It replays admitted cuts through the existing Trim operation. Hidden construction can supply a boundary under the existing click policy. It is protected from cuts.

The sketch, document, acceptance scope and viewport frame own the held stroke. Cancellation discards the preview and consumes the late release. One accepted stroke records one whole-draft step. A short press still uses click Trim. Path Gap keeps its dedicated input.

| Result | Check |
| --- | --- |
| FAIL | Desktop run 01 found that preview polylines included the projection depth as a third SVG coordinate. The preview now emits only x and y. |
| FAIL | Run 02 passed stroke, cancellation, Undo and Redo. Its driver then compared untouched construction as raw JSON. The existing Finish path adds `pending: false` to those open lines. Run 03 checks all authored fields, accounts for that normalization and verifies IDs separately. |
| PASS | On desktop, one sparse stroke from (−2, 5) to (22, 5) mm previewed removal from y=0 to y=10 at x=0, 10 and 20 mm within 0.02 CSS px. Release kept the six exterior segments, their three pairs of terminal IDs and the two bounds. One Undo restored all three lines and one Redo reapplied all three cuts. The accepted document stayed fixed until Finish. |
| PASS | Escape and its repeat, pointer cancellation, a second pointer, wheel zoom and a Hide body edit that retained the same sketch all retired a held stroke. A fourth crossed line refused the entire plan. Cancellation and refusal retained the draft and its applicable history. |
| PASS | Finish, document Undo and Redo, and OPFS Save followed by a fresh File Open preserved the exact admitted cuts and the independently checked native Extrude. All eight native corners matched the 20 × 20 × 2 mm block. Its volume stayed 800 mm³ within 1e-8 mm³. The saved file was 4,053 bytes. |
| PASS | Desktop click Trim history and ordinary Path Gap regressions, 52 focused Studio tests, both type checks, scoped lint, Vite build, driver syntax and diff check. The final stroke run held 831 source inputs through cleanup. |
| NOT_RUN | A regular material line that needs explicit closure before Finish, other curve or dimensioned targets, a browser tab switch and dedicated lost-capture flow, mobile and full suites. |

[#2328](https://github.com/barocss/barocss/issues/2328) remains open. D877 verifies the ordinary material profile boundary and explicit recovery with the existing Line tool. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
