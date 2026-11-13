# D1054 — separate overlapping Sketch length labels

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2460](https://github.com/barocss/barocss/issues/2460)

When a reference length overlaps an earlier label, try the opposite side of its edge midpoint. Place a short leader on a moved label and anchor its existing inline editor at the displayed position. Preserve the original position when the alternative has no room.

- **FAIL** At a 4 CSS px edge separation in desktop 1024 × 800 WebGPU, the two 52 × 22 CSS px labels overlapped by 936.00 CSS px². Both center clicks opened Length of edge 3.
- **PASS** Overlap is 0 CSS px². The two centers open Length of edge 1 and Length of edge 3. Escape cancels both drafts. Enter on edge 1 saves a 55 mm driving length on edge 1 only. Finish, exact document Undo and Redo pass. Visual review confirms the leader and separate labels.
- **PASS** The Fixed mark and 4 CSS px parallel highlight desktop controls, seven focused tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Dense layouts with no free opposite side, arbitrary mixed driving/reference overlaps, circle/line visual pixels, WebGL2, full suites, production build and mobile.

#2460 stays open for the remaining circle/line visual and constraint mark criteria. The scoped Fixed mark replay links [#2377](https://github.com/barocss/barocss/issues/2377). That issue has broader acceptance. Desktop QA is 17/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
