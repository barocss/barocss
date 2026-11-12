# D881 — Measure the placed edge snap baseline

P1, rows 09, 10 and 16. SMALL qualification. Desktop Studio opened one native root box and two top-level static copies of the same 20 × 12 × 6 mm definition. Their translations were (10.25, 14.25, 0) and (55.75, 34.25, 0) mm. Independent reads checked all native box corners and the two eligible straight edges on XY at Z 0.

| Result | Check |
| --- | --- |
| PASS | The same viewport showed End and Middle on the root control. Both placed boxes appeared at their accepted world bounds. |
| FAIL | No endpoint or midpoint cue appeared at either placed box. A real Rectangle click near the left endpoint (10.25, 14.25) and the right midpoint (65.75, 34.25) used the 1 mm grid and stored (10, 14) and (66, 34) mm. |
| PASS | The 2 mm Extrude consumed the stored grid rectangle and produced 2,240 mm³. The intended placed coordinates would give 2,220 mm³ by independent arithmetic. The original root and both placed definitions, positions and native boxes remained intact. Document Undo and Redo replayed the grid-based result. |
| PASS | Studio baseline, independent source review, 9 focused Model and 14 focused Studio tests, driver syntax and diff check. The desktop run recorded 6 states with 838 source inputs held through cleanup. |
| NOT_RUN | The placement snap repair, placement replacement, native Save and fresh Open of a snapped result, production build, mobile and full suites. |

The current snap cache receives root bodies. The placed occurrences arrive separately. The accepted placed mesh already contains world edge coordinates. The mesh reuse path drops the root `nativeLine` certificate and retains the unmerged native vertex pair. D882 will admit visible translated native box edges from the accepted occurrence and its rendered mesh, with exact source and pose checks. [#2333](https://github.com/barocss/barocss/issues/2333) remains open. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
